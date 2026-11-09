package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math/big"
	"sync"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/common/hexutil"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/rpc"
	"golang.org/x/sync/errgroup"
)

const (
	lookupBatch  = 500              // nonce queries per JSON-RPC batch
	syncInterval = 10 * time.Minute // how often to merge txpool_content
)

type header struct {
	Number     hexutil.Uint64 `json:"number"`
	Hash       common.Hash    `json:"hash"`
	ParentHash common.Hash    `json:"parentHash"`
}

// rpcTx is the part of a JSON-RPC transaction object we need.
type rpcTx struct {
	From              common.Address               `json:"from"`
	Nonce             hexutil.Uint64               `json:"nonce"`
	Gas               hexutil.Uint64               `json:"gas"`
	GasPrice          *hexutil.Big                 `json:"gasPrice"`
	MaxFeePerGas      *hexutil.Big                 `json:"maxFeePerGas"`
	AuthorizationList []types.SetCodeAuthorization `json:"authorizationList"`
}

func (t *rpcTx) tx(now int64) tx {
	price := t.MaxFeePerGas
	if price == nil {
		price = t.GasPrice
	}
	var gwei float64
	if price != nil {
		gwei, _ = new(big.Float).SetInt(price.ToInt()).Float64()
		gwei /= 1e9
	}
	return tx{Gas: uint64(t.Gas), FeeCap: gwei, LastSeen: now}
}

type daemon struct {
	url string

	mu       sync.Mutex
	pool     *pool
	head     header // latest block processed
	synced   bool   // txpool_content was merged since connecting
	ready    bool   // synced and all nonces looked up once: stats are valid
	noTxpool bool   // node has no txpool_content
}

// run connects to the node and follows it until an error occurs.
func (d *daemon) run(ctx context.Context) error {
	c, err := rpc.DialOptions(ctx, d.url, rpc.WithWebsocketMessageSizeLimit(1<<30))
	if err != nil {
		return err
	}
	defer c.Close()

	var head header
	if err := c.CallContext(ctx, &head, "eth_getBlockByNumber", "latest", false); err != nil {
		return err
	}
	d.mu.Lock()
	d.head = head
	d.synced = false
	// we may have missed blocks while not connected
	d.pool.forget()
	d.mu.Unlock()

	// Subscribe before fetching txpool_content, so no tx falls in between.
	pending := make(chan json.RawMessage, 4096)
	psub, err := c.EthSubscribe(ctx, pending, "newPendingTransactions", true)
	if err != nil {
		// Besu wants an options object instead of a bool
		psub, err = c.EthSubscribe(ctx, pending, "newPendingTransactions",
			map[string]bool{"includeTransactions": true})
	}
	if err != nil {
		return fmt.Errorf("subscribe newPendingTransactions: %w", err)
	}
	defer psub.Unsubscribe()
	heads := make(chan header, 64)
	hsub, err := c.EthSubscribe(ctx, heads, "newHeads")
	if err != nil {
		return fmt.Errorf("subscribe newHeads: %w", err)
	}
	defer hsub.Unsubscribe()

	g, ctx := errgroup.WithContext(ctx)
	g.Go(func() error { return d.receivePending(ctx, psub, pending) })
	g.Go(func() error { return d.followHeads(ctx, c, hsub, heads) })
	g.Go(func() error { return d.lookupNonces(ctx, c) })
	g.Go(func() error { return d.syncTxpool(ctx, c) })
	return g.Wait()
}

func (d *daemon) receivePending(ctx context.Context, sub *rpc.ClientSubscription, ch chan json.RawMessage) error {
	for {
		select {
		case raw := <-ch:
			var t rpcTx
			if err := json.Unmarshal(raw, &t); err != nil {
				return fmt.Errorf("pending tx %.80s: %w (node sends only hashes?)", raw, err)
			}
			now := time.Now().Unix()
			d.mu.Lock()
			d.pool.add(t.From, uint64(t.Nonce), t.tx(now), true)
			d.mu.Unlock()
		case err := <-sub.Err():
			return fmt.Errorf("newPendingTransactions: %w", err)
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

// followHeads removes the transactions included in new blocks by raising
// their senders' nonces.
func (d *daemon) followHeads(ctx context.Context, c *rpc.Client, sub *rpc.ClientSubscription, ch chan header) error {
	for {
		var h header
		select {
		case h = <-ch:
		case err := <-sub.Err():
			return fmt.Errorf("newHeads: %w", err)
		case <-ctx.Done():
			return ctx.Err()
		}
		var block struct {
			Transactions []rpcTx `json:"transactions"`
		}
		if err := c.CallContext(ctx, &block, "eth_getBlockByHash", h.Hash, true); err != nil {
			return fmt.Errorf("eth_getBlockByHash: %w", err)
		}
		// EIP-7702 authorizations also bump the authority's nonce.
		var authorities []common.Address
		for _, t := range block.Transactions {
			for _, auth := range t.AuthorizationList {
				if addr, err := auth.Authority(); err == nil {
					authorities = append(authorities, addr)
				}
			}
		}

		d.mu.Lock()
		if h.ParentHash != d.head.Hash {
			// Reorg or missed block: nonces may have changed anywhere.
			log.Printf("block %d %s does not follow %s, requerying all nonces",
				h.Number, h.Hash, d.head.Hash)
			d.pool.forget()
		}
		for _, t := range block.Transactions {
			d.pool.setNonce(t.From, uint64(t.Nonce)+1, false)
		}
		for _, addr := range authorities {
			d.pool.requestLookup(addr)
		}
		d.head = h
		d.mu.Unlock()
	}
}

// lookupNonces queries the nonces of new senders, or of all senders after a
// reorg, in batches at the current head.
func (d *daemon) lookupNonces(ctx context.Context, c *rpc.Client) error {
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()
	for {
		d.mu.Lock()
		addrs := d.pool.lookupList(lookupBatch)
		head := d.head
		if len(addrs) == 0 && d.synced && !d.ready {
			log.Printf("synced: %d txs from %d senders", d.pool.numTxs, len(d.pool.accounts))
			d.ready = true
		}
		d.mu.Unlock()

		failed := 0
		if len(addrs) > 0 {
			nonces := make([]hexutil.Uint64, len(addrs))
			batch := make([]rpc.BatchElem, len(addrs))
			at := map[string]any{"blockHash": head.Hash}
			for i, addr := range addrs {
				batch[i] = rpc.BatchElem{
					Method: "eth_getTransactionCount",
					Args:   []any{addr, at},
					Result: &nonces[i],
				}
			}
			if err := c.BatchCallContext(ctx, batch); err != nil {
				return fmt.Errorf("eth_getTransactionCount: %w", err)
			}
			d.mu.Lock()
			exact := d.head.Hash == head.Hash
			for i, addr := range addrs {
				if batch[i].Error != nil {
					failed++
					continue
				}
				d.pool.lookedUp(addr, uint64(nonces[i]), exact)
			}
			d.mu.Unlock()
			if failed > 0 {
				log.Printf("eth_getTransactionCount failed for %d addresses at %s: %v",
					failed, head.Hash, batch[0].Error)
			}
		}
		// Continue right away while there is a backlog.
		if len(addrs) < lookupBatch || failed > 0 {
			select {
			case <-ticker.C:
			case <-ctx.Done():
				return ctx.Err()
			}
		}
	}
}

// syncTxpool periodically merges the node's whole pool: initially to learn
// the txs that were pending before we subscribed, later to refresh LastSeen
// of the txs the node still has and to catch anything we missed.
func (d *daemon) syncTxpool(ctx context.Context, c *rpc.Client) error {
	for {
		var content struct {
			Pending map[common.Address]map[string]rpcTx `json:"pending"`
			Queued  map[common.Address]map[string]rpcTx `json:"queued"`
		}
		err := c.CallContext(ctx, &content, "txpool_content")
		var rpcErr rpc.Error
		if errors.As(err, &rpcErr) {
			// e.g. Besu: rely on the subscription alone
			d.mu.Lock()
			if !d.noTxpool {
				log.Printf("txpool_content not available: %v", err)
				d.noTxpool = true
			}
			d.synced = true
			d.mu.Unlock()
			return nil
		} else if err != nil {
			return fmt.Errorf("txpool_content: %w", err)
		}
		now := time.Now().Unix()
		d.mu.Lock()
		for _, txs := range []map[common.Address]map[string]rpcTx{content.Pending, content.Queued} {
			for _, byNonce := range txs {
				for _, t := range byNonce {
					// the subscription may already have delivered a replacement
					d.pool.add(t.From, uint64(t.Nonce), t.tx(now), false)
				}
			}
		}
		d.synced = true
		d.mu.Unlock()

		select {
		case <-time.After(syncInterval):
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}
