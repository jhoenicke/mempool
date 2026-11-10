# Security Policy

## Reporting a vulnerability

Please report security issues privately by email to
**hoenicke@gmail.com**, not in a public issue.

If you want to encrypt your report, you can use my PGP key
<https://jhoenicke.de/gpg-hoenicke.txt>, fingerprint
`088F 8EB2 D57A F4D6 4C40  A5EA 90AC 201D 7BFE 5D13`.
It is an old key; if your tools refuse it, send a plain email first and
we can find another way.

Please include what is affected, how to reproduce it, and what an
attacker could achieve.

## Scope

- The code in this repository: the collectors (`mempool.sh`,
  `mempool_sql.py`, `eth/`), the web frontend and `db.php` in `web/`,
  and the Lightning donation service in `lnweb/` and `web/lightning/`.
- The deployment at <https://mempool.jhoenicke.de/>.

Bugs in third-party software used here (Bitcoin Core, geth, LND,
ECharts, Flot, ...) should go to those projects.

## What to expect

This is a personal project maintained in my spare time.  I will
acknowledge your report on a best-effort basis, usually within a week,
and fix confirmed issues as soon as I can.  There is no bug bounty.
I'm happy to credit you in the fix unless you prefer otherwise.
