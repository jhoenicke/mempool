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
    $comma = $i < $feelevels - 1 ? "," : "";
    print "    fee$i BIGINT$comma\n";
}
print ");\n";
