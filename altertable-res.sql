-- Migration: cluster the mempool table by (res, time).
--
-- db.php samples "every Nth minute" with `res IN (level..5) AND time BETWEEN ...`.
-- With res as the leading column of the PRIMARY KEY the matching rows are stored
-- contiguously and read as one sequential clustered-index range -- no secondary
-- index and no per-row bookmark lookups (those turned a wide/coarse query into
-- thousands of random row fetches).  `res` is a plain column (computed by
-- mempool_sql.py) so it can be part of the PRIMARY KEY on any MariaDB version.
--
-- This assumes the interim state from the earlier version of this file:
--   res a PERSISTENT generated column, an idx_res_time index, PRIMARY KEY (time).
-- (Fresh installs get the final layout directly from mempool-create.pl.)
--
-- The single ALTER below rebuilds the table once.  Adding res as the PRIMARY
-- KEY prefix physically reorders every row, so on a large table this is slow
-- and holds a lock -- run it during a quiet moment.  Inserts during the rebuild
-- fail (a harmless DB gap; the static .js files come from mempool.log).

-- Optional 5-second probe on a scratch table: confirms your MariaDB both
-- converts the generated column with MODIFY and keeps its stored values, so the
-- big ALTER below is safe.  Expect res = 0 and 1 in the SELECT.
--
--   CREATE TABLE _restest (t BIGINT NOT NULL,
--     res TINYINT AS ((t DIV 60) MOD 2) PERSISTENT, PRIMARY KEY (t));
--   INSERT INTO _restest (t) VALUES (60), (120);
--   ALTER TABLE _restest
--     MODIFY COLUMN res TINYINT NOT NULL, DROP PRIMARY KEY, ADD PRIMARY KEY (res, t);
--   SELECT * FROM _restest;          -- res must be 0 then 1 (values preserved)
--   DROP TABLE _restest;

ALTER TABLE mempool
  DROP INDEX idx_res_time,
  MODIFY COLUMN res TINYINT NOT NULL,   -- generated -> plain, keeps stored values
  DROP PRIMARY KEY,
  ADD PRIMARY KEY (res, time);

-- Fallback, if the probe shows MODIFY won't convert the generated column on your
-- version.  Run these instead of the single ALTER above (more table rebuilds):
--
--   ALTER TABLE mempool DROP INDEX idx_res_time;
--   ALTER TABLE mempool ADD COLUMN res_tmp TINYINT NOT NULL DEFAULT 0;
--   UPDATE mempool SET res_tmp = res;
--   ALTER TABLE mempool DROP COLUMN res;
--   ALTER TABLE mempool CHANGE COLUMN res_tmp res TINYINT NOT NULL;
--   ALTER TABLE mempool DROP PRIMARY KEY, ADD PRIMARY KEY (res, time);
