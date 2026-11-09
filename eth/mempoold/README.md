# mempoold

Keeps its own copy of an Ethereum node's pending transactions, grouped by
sender, and serves the per-minute sample in the `mempool.log` format.  Unlike
`geth txpool.inspect`, it is not limited by the node's pool size: transactions
the node evicts stay until they are mined, replaced, or not reported by the node
for `-lifetime` (default 12h).

It follows the node over websocket or IPC:

- `eth_subscribe newPendingTransactions` (with full transactions) for new txs.
  Geth takes `true`, Besu `{"includeTransactions": true}`; both are tried.
- `txpool_content` at start and every 10 minutes, for txs that were pending
  before subscribing and to refresh the ones the node still holds.  Without it
  (Besu), the subscription is the only source.
- `eth_subscribe newHeads` + `eth_getBlockByHash` to raise the senders' nonces
  and drop mined txs.  EIP-7702 authorities and, after a reorg or a missed block,
  all senders get their nonce requeried with `eth_getTransactionCount`.

Txs are bucketed into the 70 fee levels of the eth `ranges` in
`web/queue/mempoolv2.js` (0 to 1000 gwei), like `parse_inspect.pl` does: by the minimum fee cap
(`maxFeePerGas`, or `gasPrice` for legacy txs) along the sender's nonce chain,
starting at the sender's next nonce.  Txs after a nonce gap are kept but not
counted.  The pool is saved to `-state` every 5 minutes and on exit.

## Build and run

    go build
    ./mempoold -node ws://127.0.0.1:8546 -state /home/ethereum/mempool/mempoold.state

Geth needs `--ws --ws.api eth,txpool` (or use its IPC path for `-node`).

`curl http://127.0.0.1:8549/status` shows the pool size and sync state.
`/stats` returns the sample line, or 503 until the initial sync is done.
To switch `eth/mempool.sh` over, replace the `geth --exec ... | perl
parse_inspect.pl` line with

    LINE=$(curl -sf http://127.0.0.1:8549/stats) || { rmdir $DESTDIR/LOCK; exit 1; }

and, since a row has 1 + 3*70 values, its `cut -d, -f1-139` with `-f1-211`.
