$feelevels = 46;

print <<"EOF";
CREATE TABLE mempool (
    time BIGINT NOT NULL PRIMARY KEY,
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
# Persistent resolution level: the coarsest sampling step (in minutes) that
# this row is a representative of.  Lets db.php pick samples via an index
# instead of a non-sargable MOD over the whole range.  The ladder steps must
# each divide the next, so that res >= L  <=>  minute divisible by step[L].
print <<"EOF";
    res TINYINT AS (
        CASE WHEN (time DIV 60) MOD 1440 = 0 THEN 5
             WHEN (time DIV 60) MOD 360 = 0 THEN 4
             WHEN (time DIV 60) MOD 60 = 0 THEN 3
             WHEN (time DIV 60) MOD 10 = 0 THEN 2
             WHEN (time DIV 60) MOD 2 = 0 THEN 1
             ELSE 0 END) PERSISTENT
);
CREATE INDEX idx_res_time ON mempool (res, time);
EOF
