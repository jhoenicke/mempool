package main

import (
	"context"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/rpc"
)

var (
	alice = common.HexToAddress("0xa1")
	bob   = common.HexToAddress("0xb0")
)

func jsonTx(from common.Address, nonce uint64, gwei uint64) map[string]any {
	return map[string]any{
		"from":         from,
		"nonce":        fmt.Sprintf("0x%x", nonce),
		"gas":          "0x5208",
		"maxFeePerGas": fmt.Sprintf("0x%x", gwei*1e9),
	}
}

func blockHash(n uint64) common.Hash {
	return common.BigToHash(new(big.Int).SetUint64(n))
}

func jsonHead(n uint64) map[string]any {
	return map[string]any{
		"number":     fmt.Sprintf("0x%x", n),
		"hash":       blockHash(n),
		"parentHash": blockHash(n - 1),
	}
}

// fakeNode serves the few JSON-RPC calls the daemon uses.
type fakeNode struct {
	mu       sync.Mutex
	nonces   map[common.Address]uint64
	txpool   map[string]any
	blocks   map[common.Hash][]any
	head     uint64
	notifier [2]*rpc.Notifier
	subs     [2]*rpc.Subscription // pending, heads
}

func (f *fakeNode) subscribe(ctx context.Context, i int) (*rpc.Subscription, error) {
	n, _ := rpc.NotifierFromContext(ctx)
	f.mu.Lock()
	defer f.mu.Unlock()
	f.notifier[i], f.subs[i] = n, n.CreateSubscription()
	return f.subs[i], nil
}

func (f *fakeNode) NewPendingTransactions(ctx context.Context, full bool) (*rpc.Subscription, error) {
	return f.subscribe(ctx, 0)
}

func (f *fakeNode) NewHeads(ctx context.Context) (*rpc.Subscription, error) {
	return f.subscribe(ctx, 1)
}

func (f *fakeNode) notify(i int, v any) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.notifier[i].Notify(f.subs[i].ID, v)
}

func (f *fakeNode) GetBlockByNumber(tag string, full bool) map[string]any {
	f.mu.Lock()
	defer f.mu.Unlock()
	return jsonHead(f.head)
}

func (f *fakeNode) GetBlockByHash(hash common.Hash, full bool) map[string]any {
	f.mu.Lock()
	defer f.mu.Unlock()
	return map[string]any{"transactions": f.blocks[hash]}
}

func (f *fakeNode) GetTransactionCount(addr common.Address, at json.RawMessage) string {
	f.mu.Lock()
	defer f.mu.Unlock()
	return fmt.Sprintf("0x%x", f.nonces[addr])
}

type fakeTxpool struct{ f *fakeNode }

func (t fakeTxpool) Content() map[string]any {
	t.f.mu.Lock()
	defer t.f.mu.Unlock()
	return t.f.txpool
}

func waitFor(t *testing.T, what string, cond func() bool) {
	t.Helper()
	for i := 0; i < 500; i++ {
		if cond() {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("timeout waiting for %s", what)
}

// levels returns the counts per fee level as "gwei:count" pairs.
func levels(d *daemon) string {
	d.mu.Lock()
	defer d.mu.Unlock()
	count, _, _ := d.pool.stats()
	var s []string
	for i, c := range count {
		if c != 0 {
			s = append(s, fmt.Sprintf("%g:%d", feeLimits[i], c))
		}
	}
	return strings.Join(s, " ")
}

func TestDaemon(t *testing.T) {
	f := &fakeNode{
		nonces: map[common.Address]uint64{alice: 5},
		head:   100,
		blocks: map[common.Hash][]any{},
		txpool: map[string]any{
			"pending": map[string]any{
				alice.Hex(): map[string]any{
					"5": jsonTx(alice, 5, 10),
					"6": jsonTx(alice, 6, 20),
				},
			},
			"queued": map[string]any{},
		},
	}
	srv := rpc.NewServer()
	srv.RegisterName("eth", f)
	srv.RegisterName("txpool", fakeTxpool{f})
	hs := httptest.NewServer(srv.WebsocketHandler([]string{"*"}))
	defer hs.Close()

	d := &daemon{url: "ws://" + hs.Listener.Addr().String(), pool: newPool()}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go d.run(ctx)

	waitFor(t, "sync", func() bool { d.mu.Lock(); defer d.mu.Unlock(); return d.ready })
	if got, want := levels(d), "10:2"; got != want {
		t.Fatalf("after sync: %s, want %s", got, want)
	}

	// bob is new (nonce 0), alice replaces nonce 6 and adds one with a gap
	f.notify(0, jsonTx(bob, 0, 3))
	f.notify(0, jsonTx(alice, 6, 30))
	f.notify(0, jsonTx(alice, 8, 50))
	waitFor(t, "pending txs", func() bool { return levels(d) == "3:1 10:2" })

	// alice's nonce 5 gets mined
	f.mu.Lock()
	f.head++
	f.nonces[alice] = 6
	f.blocks[blockHash(f.head)] = []any{jsonTx(alice, 5, 10)}
	f.mu.Unlock()
	f.notify(1, jsonHead(101))
	waitFor(t, "block", func() bool { return levels(d) == "3:1 30:1" })

	// gap filled
	f.notify(0, jsonTx(alice, 7, 40))
	waitFor(t, "gap", func() bool { return levels(d) == "3:1 30:3" })

	d.mu.Lock()
	n := d.pool.numTxs
	d.mu.Unlock()
	if n != 4 {
		t.Fatalf("numTxs = %d, want 4", n)
	}
}

func TestEvictAndPersist(t *testing.T) {
	p := newPool()
	p.add(alice, 0, tx{Gas: 1, FeeCap: 5}, true)
	p.add(alice, 1, tx{Gas: 1, FeeCap: 50}, true)
	p.add(bob, 0, tx{Gas: 1, FeeCap: 2, LastSeen: 100}, true)
	p.add(bob, 1, tx{Gas: 1, FeeCap: 1}, true)
	p.lookedUp(alice, 0, true)
	p.lookedUp(bob, 0, true)
	p.evict(3) // keeps 2: alice's chain, bob's go first (lower fees)
	if p.numTxs != 2 || p.accounts[bob] != nil {
		t.Fatalf("evict left %d txs, bob %v", p.numTxs, p.accounts[bob])
	}

	path := t.TempDir() + "/state"
	d := &daemon{pool: p}
	if err := d.save(path); err != nil {
		t.Fatal(err)
	}
	q := newPool()
	if err := load(q, path); err != nil {
		t.Fatal(err)
	}
	if q.numTxs != 2 || q.accounts[alice].Txs[1].FeeCap != 50 {
		t.Fatalf("loaded %+v", q.accounts[alice])
	}
	q.expire(1)
	if q.numTxs != 0 || len(q.accounts) != 0 {
		t.Fatalf("expire left %d txs", q.numTxs)
	}
}
