package main

import (
	"math"
	"sort"

	"github.com/ethereum/go-ethereum/common"
)

// feeLimits are the lower bounds, in gwei, of the fee levels the
// transactions are bucketed into.  Keep in sync with the eth "ranges" in
// web/queue/mempoolv2.js.
var feeLimits = []float64{0, .001, .002, .003, .004, .005, .006, .007, .008, .01,
	.012, .014, .017, .02, .025, .03, .04, .05, .06, .07, .08, .1,
	.12, .14, .17, .2, .25, .3, .4, .5, .6, .7, .8, 1,
	1.2, 1.4, 1.7, 2, 2.5, 3, 4, 5, 6, 7, 8, 10,
	12, 14, 17, 20, 25, 30, 40, 50, 60, 70, 80, 100,
	120, 140, 170, 200, 250, 300, 400, 500, 600, 700, 800, 1000}

type tx struct {
	Gas      uint64
	FeeCap   float64 // max fee per gas (gas price for legacy txs) in gwei
	LastSeen int64   // unix time the node last reported this tx
}

type account struct {
	Nonce      uint64 // next nonce according to the chain state
	NonceKnown bool   // Nonce was learned from the node at least once
	NeedLookup bool   // Nonce must be (re)queried from the node
	Txs        map[uint64]tx
}

// pool holds the pending transactions grouped by sender.  It does no
// locking; the daemon serializes all access.
type pool struct {
	accounts map[common.Address]*account
	numTxs   int
}

func newPool() *pool {
	return &pool{accounts: make(map[common.Address]*account)}
}

// add inserts a transaction.  An existing transaction with the same sender
// and nonce is replaced if replace is set, otherwise only if the new one
// pays more: a valid replacement always raises the fee, so the higher
// paying one is the newer one.
func (p *pool) add(from common.Address, nonce uint64, t tx, replace bool) {
	acc := p.accounts[from]
	if acc == nil {
		acc = &account{NeedLookup: true, Txs: make(map[uint64]tx)}
		p.accounts[from] = acc
	} else if acc.NonceKnown && nonce < acc.Nonce {
		return
	}
	old, exists := acc.Txs[nonce]
	if !exists {
		p.numTxs++
	} else if !replace && old.FeeCap > t.FeeCap {
		old.LastSeen = max(old.LastSeen, t.LastSeen)
		acc.Txs[nonce] = old
		return
	}
	acc.Txs[nonce] = t
}

// setNonce records that nonce is the next nonce of addr and drops the
// transactions below it.  Unless exact is set, the nonce only increases.
func (p *pool) setNonce(addr common.Address, nonce uint64, exact bool) {
	acc := p.accounts[addr]
	if acc == nil {
		return
	}
	if !exact && acc.NonceKnown && nonce <= acc.Nonce {
		return
	}
	acc.Nonce = nonce
	acc.NonceKnown = true
	for n := range acc.Txs {
		if n < nonce {
			delete(acc.Txs, n)
			p.numTxs--
		}
	}
	if len(acc.Txs) == 0 {
		delete(p.accounts, addr)
	}
}

// requestLookup marks the nonce of addr to be queried again.
func (p *pool) requestLookup(addr common.Address) {
	if acc := p.accounts[addr]; acc != nil {
		acc.NeedLookup = true
	}
}

// forget marks all nonces to be queried again, e.g. after a reorg.
func (p *pool) forget() {
	for _, acc := range p.accounts {
		acc.NeedLookup = true
	}
}

// lookupList returns up to limit addresses whose nonce must be queried.
func (p *pool) lookupList(limit int) []common.Address {
	var addrs []common.Address
	for addr, acc := range p.accounts {
		if acc.NeedLookup {
			addrs = append(addrs, addr)
			if len(addrs) == limit {
				break
			}
		}
	}
	return addrs
}

// lookedUp stores a queried nonce.  The query is only exact if the chain
// head did not move meanwhile; otherwise the nonce is just raised and the
// lookup repeated.
func (p *pool) lookedUp(addr common.Address, nonce uint64, exact bool) {
	acc := p.accounts[addr]
	if acc == nil {
		return
	}
	if exact {
		acc.NeedLookup = false
	}
	p.setNonce(addr, nonce, exact)
}

// expire drops transactions the node has not reported since cutoff.
func (p *pool) expire(cutoff int64) {
	for addr, acc := range p.accounts {
		for n, t := range acc.Txs {
			if t.LastSeen < cutoff {
				delete(acc.Txs, n)
				p.numTxs--
			}
		}
		if len(acc.Txs) == 0 {
			delete(p.accounts, addr)
		}
	}
}

// walk calls f for every transaction with its effective fee: the minimum
// fee cap along the nonce chain starting at the account's next nonce,
// since a transaction can't be mined before its predecessors.
// Transactions not connected to the next nonce get an effective fee of -1.
func (p *pool) walk(f func(addr common.Address, nonce uint64, t tx, eff float64)) {
	for addr, acc := range p.accounts {
		eff := math.Inf(1)
		next := acc.Nonce
		if !acc.NonceKnown {
			next = math.MaxUint64
		}
		for {
			t, ok := acc.Txs[next]
			if !ok {
				break
			}
			eff = min(eff, t.FeeCap)
			f(addr, next, t, eff)
			next++
		}
		for n, t := range acc.Txs {
			if !acc.NonceKnown || n < acc.Nonce || n >= next {
				f(addr, n, t, -1)
			}
		}
	}
}

// evict drops the transactions with the lowest effective fee until at most
// 90% of limit remain.  Transactions with gaps go first.
func (p *pool) evict(limit int) {
	if p.numTxs <= limit {
		return
	}
	type ref struct {
		addr  common.Address
		nonce uint64
		eff   float64
	}
	refs := make([]ref, 0, p.numTxs)
	p.walk(func(addr common.Address, nonce uint64, t tx, eff float64) {
		refs = append(refs, ref{addr, nonce, eff})
	})
	// Within an account the effective fee never increases with the nonce,
	// so on ties drop the highest nonce first to avoid creating gaps.
	sort.Slice(refs, func(i, j int) bool {
		if refs[i].eff != refs[j].eff {
			return refs[i].eff < refs[j].eff
		}
		return refs[i].nonce > refs[j].nonce
	})
	for _, r := range refs[:p.numTxs-limit*9/10] {
		acc := p.accounts[r.addr]
		delete(acc.Txs, r.nonce)
		if len(acc.Txs) == 0 {
			delete(p.accounts, r.addr)
		}
	}
	p.numTxs = limit * 9 / 10
}

// stats buckets the transactions by effective fee into the fee levels and
// returns per level the count, the gas (used as size) and the fees in gwei.
// Like parse_inspect.pl it adds up each transaction's own fee cap.
func (p *pool) stats() (count, size, fees []int64) {
	count = make([]int64, len(feeLimits))
	size = make([]int64, len(feeLimits))
	feesum := make([]float64, len(feeLimits))
	p.walk(func(_ common.Address, _ uint64, t tx, eff float64) {
		if eff < 0 {
			return
		}
		i := sort.Search(len(feeLimits), func(i int) bool { return feeLimits[i] > eff }) - 1
		count[i]++
		size[i] += int64(t.Gas)
		feesum[i] += float64(t.Gas) * t.FeeCap
	})
	fees = make([]int64, len(feeLimits))
	for i, f := range feesum {
		fees[i] = int64(f)
	}
	return count, size, fees
}
