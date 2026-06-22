-- Migration: add `res` and cluster the mempool table by (res, time).
--
-- db.php samples "every Nth minute" with `res IN (level..5) AND time BETWEEN ...`.
-- With res as the leading column of the PRIMARY KEY the matching rows are stored
-- contiguously and read as one sequential clustered-index range -- no secondary
-- index and no per-row bookmark lookups (those turn a wide/coarse query into
-- thousands of random row fetches).  res is a plain column (computed by
-- mempool_sql.py) so it can be part of the PRIMARY KEY on any MariaDB version.
--
-- Run this on a database still in the ORIGINAL layout: PRIMARY KEY (time),
-- no res column.  (Fresh installs get the final layout from mempool-create.pl.)
-- Deploy the updated mempool_sql.py, which computes and inserts res, together
-- with this migration -- afterwards the old writer's INSERT no longer matches.
--
-- This is a full table rebuild: slow and locking on a large table, so run it
-- during a quiet moment.  Inserts that fail during the rebuild are harmless
-- (a DB gap only; the static .js files come from mempool.log).

-- 1. Add res and backfill it WHILE IT IS STILL A PLAIN, NON-INDEXED COLUMN.
--    This update is in-place (rows don't move), so it's cheap.  Do NOT make res
--    part of the primary key before this, or every row would move during the
--    backfill.  The ladder steps each divide the next, so res >= L is exactly
--    "minute divisible by step[L]".
ALTER TABLE mempool ADD COLUMN res TINYINT NOT NULL DEFAULT 0;

UPDATE mempool SET res =
  CASE WHEN (time DIV 60) MOD 1440 = 0 THEN 5
       WHEN (time DIV 60) MOD 360 = 0 THEN 4
       WHEN (time DIV 60) MOD 60 = 0 THEN 3
       WHEN (time DIV 60) MOD 10 = 0 THEN 2
       WHEN (time DIV 60) MOD 2 = 0 THEN 1
       ELSE 0 END;

-- 2. Cluster by (res, time): one rebuild that places every row in PK order.
ALTER TABLE mempool DROP PRIMARY KEY, ADD PRIMARY KEY (res, time);


-- ---------------------------------------------------------------------------
-- If a database is instead in the earlier INTERIM state (res a PERSISTENT
-- generated column + idx_res_time + PRIMARY KEY (time)), don't run the above.
-- Convert it in a single rebuild instead:
--
--   ALTER TABLE mempool
--     DROP INDEX idx_res_time,
--     MODIFY COLUMN res TINYINT NOT NULL,   -- generated -> plain, keeps values
--     DROP PRIMARY KEY,
--     ADD PRIMARY KEY (res, time);
--
-- (If MODIFY won't convert the generated column on your version: drop res,
--  re-add it as a plain column, backfill with the UPDATE above, then set the
--  primary key.)
