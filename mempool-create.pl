$feelevels = 46;

print <<"EOF";
CREATE TABLE mempool (
    time BIGINT NOT NULL,
EOF

for $i (0..($feelevels - 1)) {
    print "    cnt$i INTEGER,\n";
}
for $i (0..($feelevels - 1)) {
    print "    size$i INTEGER,\n";
}
for $i (0..($feelevels - 1)) {
    print "    fee$i BIGINT,\n";
}
# res = coarsest sampling step (in minutes) this row is a representative of,
# over a nested ladder where each step divides the next, so that
# res >= L  <=>  minute divisible by step[L].  Computed by mempool_sql.py.
# It leads the PRIMARY KEY so the table is clustered by (res, time): db.php
# reads all rows of a given resolution as one sequential range, with no
# secondary-index row lookups.  See db.php and altertable-res.sql.
print <<"EOF";
    res TINYINT NOT NULL,
    PRIMARY KEY (res, time)
);
EOF
