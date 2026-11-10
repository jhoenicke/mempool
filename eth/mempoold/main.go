// mempoold keeps its own copy of an Ethereum node's pending transactions,
// grouped by sender, and writes the mempool statistics in the format of
// mempool.log after the first block of each minute.  Unlike the node's own pool it is not limited in size, so it
// also covers the low fee transactions the node evicts.
package main

import (
	"bytes"
	"context"
	"encoding/gob"
	"errors"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"
)

var (
	nodeURL  = flag.String("node", "ws://127.0.0.1:8546", "node's websocket URL or IPC path")
	listen   = flag.String("listen", "127.0.0.1:8549", "address to serve /stats and /status on")
	state    = flag.String("state", "mempoold.state", "file the pool is saved to")
	lifetime = flag.Duration("lifetime", 12*time.Hour, "drop txs the node hasn't reported for this long")
	maxTxs   = flag.Int("maxtxs", 1000000, "maximum number of txs to keep")
	samples  = flag.String("samples", "", "file to append a sample to after the first block of each minute")
	hook     = flag.String("exec", "", "shell command to run after each sample, e.g. push.sh")
)

const saveInterval = 5 * time.Minute

func main() {
	flag.Parse()
	d := &daemon{url: *nodeURL, pool: newPool(), samples: *samples, hook: *hook}
	if err := load(d.pool, *state); err != nil && !errors.Is(err, os.ErrNotExist) {
		log.Fatalf("loading %s: %v", *state, err)
	}
	log.Printf("loaded %d txs from %d senders", d.pool.numTxs, len(d.pool.accounts))
	if *samples != "" {
		d.lastMinute = lastSampleMinute(*samples)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	http.HandleFunc("/stats", d.serveStats)
	http.HandleFunc("/status", d.serveStatus)
	go func() { log.Fatal(http.ListenAndServe(*listen, nil)) }()
	go d.maintain(ctx)

	backoff := time.Second
	for ctx.Err() == nil {
		start := time.Now()
		err := d.run(ctx)
		if ctx.Err() != nil {
			break
		}
		d.mu.Lock()
		d.ready = false
		d.mu.Unlock()
		if time.Since(start) > time.Minute {
			backoff = time.Second
		}
		log.Printf("node connection failed: %v; retrying in %v", err, backoff)
		select {
		case <-time.After(backoff):
		case <-ctx.Done():
		}
		backoff = min(2*backoff, time.Minute)
	}
	if err := d.save(*state); err != nil {
		log.Fatalf("saving %s: %v", *state, err)
	}
}

// maintain expires and evicts old txs every minute and saves the pool
// every saveInterval.
func (d *daemon) maintain(ctx context.Context) {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	lastSave := time.Now()
	for {
		select {
		case <-ticker.C:
		case <-ctx.Done():
			return
		}
		d.mu.Lock()
		d.pool.expire(time.Now().Add(-*lifetime).Unix())
		d.pool.evict(*maxTxs)
		d.mu.Unlock()
		if time.Since(lastSave) >= saveInterval {
			if err := d.save(*state); err != nil {
				log.Printf("saving %s: %v", *state, err)
			}
			lastSave = time.Now()
		}
	}
}

func (d *daemon) save(path string) error {
	var buf bytes.Buffer
	d.mu.Lock()
	err := gob.NewEncoder(&buf).Encode(d.pool.accounts)
	d.mu.Unlock()
	if err != nil {
		return err
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, buf.Bytes(), 0644); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

func load(p *pool, path string) error {
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()
	if err := gob.NewDecoder(f).Decode(&p.accounts); err != nil {
		return err
	}
	for _, acc := range p.accounts {
		p.numTxs += len(acc.Txs)
	}
	// nonces are requeried when connecting to the node
	return nil
}

// serveStats prints the current pool as a mempool.log line.
func (d *daemon) serveStats(w http.ResponseWriter, r *http.Request) {
	d.mu.Lock()
	defer d.mu.Unlock()
	if !d.ready {
		http.Error(w, "not synced", http.StatusServiceUnavailable)
		return
	}
	fmt.Fprint(w, d.sampleLocked(time.Now().Unix()))
}

func (d *daemon) serveStatus(w http.ResponseWriter, r *http.Request) {
	d.mu.Lock()
	defer d.mu.Unlock()
	lookups := len(d.pool.lookupList(-1))
	fmt.Fprintf(w, "ready: %v\nhead: %d %s\ntxs: %d\nsenders: %d\nnonce lookups pending: %d\ntxpool_inspect: %v\n",
		d.ready, d.head.Number, d.head.Hash, d.pool.numTxs, len(d.pool.accounts),
		lookups, !d.noTxpool)
}

func join(xs []int64) string {
	s := make([]string, len(xs))
	for i, x := range xs {
		s[i] = fmt.Sprint(x)
	}
	return strings.Join(s, ",")
}
