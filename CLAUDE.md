# CLAUDE.md

Mempool statistics collector + web visualization behind <https://mempool.jhoenicke.de/>.
It samples a node's mempool once a minute, bucketing unconfirmed transactions by
fee rate, and serves interactive fee/size/count charts. See `README.md` for the
full production install; this file is the orientation for working in the code.

## Architecture / data flow

Per-minute cron drives `mempool.sh`:

1. `bitcoin-cli getrawmempool true` dumps the raw mempool to a tmp file.
2. `mempool_sql.py` reads it, computes an effective fee-per-byte for each tx
   (the CPFP-aware `feeperbyte` in `parse_txdata`), buckets txs into the
   `FEELIMIT` fee levels, and writes one sample row both to:
   - `mempool.log` — append-only text, the source of truth for the static files.
   - MySQL table `mempool` (DB `btc_mempool`) — for dynamic zoom/auto-update.
3. `mkdata.sh` (re)builds, and `updatedata.sh` incrementally maintains, the
   static per-period JSONP files (`2h.js` … `1y.js`, `all.js`) in a ramdisk
   (`/dev/shm/mempool-btc`), each a downsample of `mempool.log`.

The web tier reads those static `.js` files as the fast path; `web/queue/db.php`
serves higher-resolution slices straight from MySQL for zoom/live updates.

## Data format (important, shared across components)

- A sample row is `[time, [counts], [sizes], [fees]]`, one array entry per fee
  level. **46 fee levels** — the constant lives in `mempool_sql.py` (`FEELIMIT`),
  `mempool-create.pl` (`$feelevels`), and `db.php` (`$feelevels`); keep them in sync.
- Both the static files and `db.php` emit JSONP: the body is wrapped in
  `call([ ...rows... ])`, fetched via a `<script>` tag (see `loadJSONP`).
- Times are unix **seconds** in the data; the JS multiplies by 1000 for ms.

### The `res` resolution ladder (DB sampling)

`db.php` answers "every Nth minute" queries. Rather than a non-indexable `MOD`,
each row carries `res` = the coarsest ladder step it belongs to, over nested
steps `[1, 2, 10, 60, 360, 1440]` minutes (each divides the next), so
`res >= L  ⇔  minute divisible by step[L]`. `res` leads the `PRIMARY KEY
(res, time)`, so a resolution query is one sequential clustered-index range.
- Fresh DB: `mempool-create.pl | mysql` already produces this layout.
- Existing DB: migrate with `altertable-res.sql` (read its header — the correct
  statements depend on the DB's current state). `altertable.sql` / `altertable-fee.sql`
  are older migrations.

## Web frontend (`web/queue/`)

- `index.html` / `mempoolv2.js` — the **current** chart, built on Apache ECharts
  (bundled `echarts.min.js`, v5.5.1). Merged to `master` from the `echarts-poc`
  branch, and now the page served as `index.html`. Multi-coin, `classes = btc,
  eth, bch, doge, ltc, dash` (derived from `config[].classname`; `donatebutton`
  marks which coins get a donate button). Key ideas in `mempoolv2.js`:
  - Tiered, lazy backdrop loading instead of eagerly fetching `all.js`: the
    selected period's own static file loads first; a "30d" medium backdrop
    loads next in the background (skipped if the period is already >= 30d);
    the full `all.js` backdrop is only fetched lazily, once a zoom/pan
    gesture actually reaches data none of the loaded tiers cover. See
    `detailTier`/`medTier`/`allTier`, `setView`, `maybeLoadAllTier`.
  - The x-axis is fixed to each coin's true full-history bounds from the very
    first render via `config[].historyStart` (a hardcoded per-coin unix
    timestamp — the first row of that coin's `all.js` — so dataZoom can
    drag/pinch to the true edge before `all.js` itself has ever loaded).
  - The chart is always fed a data slice restricted to the visible window
    (plus one padding point per edge), not a tier's full extent, so the
    y-axis auto-scale reflects only what's on screen (`sliceRaw`/`setActive`).
  - `buildStructured(raw, dataidx)` materializes only the currently displayed
    metric (count/fee/weight); raw rows are kept to rebuild on a metric switch.
  - `incrementFor`/`targetPoints` cap points per band to ~chart width (mobile
    perf). Bands are native-`stack`ed areas; fills are baked opaque + stroked in
    their own color to hide anti-aliasing seams (see `bakeColor`).
  - Tooltip is band-focused: it maps cursor y → hovered stacked band and lists a
    window of `TOOLTIP_BANDS` around it.
  - `loadJSONP`/`pumpJSONP` serialize all `<script>`-tag JSONP fetches (static
    files and `db.php` share one `window.call` callback) and retry a failed
    fetch after a minute, a few times, since a static file can transiently
    404 (e.g. `/dev/shm` getting cleared — see git history for how that was
    diagnosed).
- `old.html` / `mempool.js` — the previous production chart, built on Flot
  (`web/flot/`), kept as a fallback. Multi-coin (`classes = btc, bch, ltc,
  dash, doge, eth`).

## Other pieces

- `eth/` — separate Ethereum pipeline (own `mempool.sh`, DB `eth_mempool`, fed by
  `geth txpool.inspect` via `parse_inspect.pl` / `txpool_parse.py`).
- `web/lightning/`, `web/lnd/` — Lightning donation / LNURL invoicing.
- `tools/` — DB dump/merge and tx-rebroadcast helpers.

## Conventions

- No build system or test suite — Perl/Python/PHP/Bash + static JS, deployed by
  copying/symlinking. To develop the frontend locally, serve `web/queue/`
  statically; chart data comes from the live server via JSONP, so no local DB
  is needed.
- Git commits in this repo use the author `Jochen Hoenicke <hoenicke@gmail.com>`.
- License: AGPL-3.0 (`LICENSE`); keep the per-file headers.
