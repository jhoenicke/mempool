-- Migration: add the persistent resolution column + index to an existing
-- mempool table, so db.php can sample "every Nth minute" through an index
-- instead of a non-sargable (time DIV 60) MOD :increment scan of the range.
--
-- `res` is the coarsest sampling level a row belongs to, using a ladder of
-- minute steps where each step divides the next (1, 2, 10, 60, 360, 1440).
-- Because the ladder is nested, a row is a valid sample for level L exactly
-- when res >= L, which db.php turns into an indexed `res IN (L..5)` lookup.
--
-- Adding a PERSISTENT generated column rebuilds the table and computes the
-- value for every existing row -- no separate backfill needed.  On a large
-- table this is a one-time, potentially long-running operation; run it once
-- during a quiet moment.

ALTER TABLE mempool
  ADD COLUMN res TINYINT AS (
      CASE WHEN (time DIV 60) MOD 1440 = 0 THEN 5
           WHEN (time DIV 60) MOD 360 = 0 THEN 4
           WHEN (time DIV 60) MOD 60 = 0 THEN 3
           WHEN (time DIV 60) MOD 10 = 0 THEN 2
           WHEN (time DIV 60) MOD 2 = 0 THEN 1
           ELSE 0 END) PERSISTENT;

CREATE INDEX idx_res_time ON mempool (res, time);
