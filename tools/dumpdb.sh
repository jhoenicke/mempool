#!/bin/bash

DB=$1

sqlite3 $1 <<EOF | perl -pe 's/\s+//s;
my @vals = map { $_ || 0 } (split ",", $_, -1);
my $time = shift @vals;
my $cnt  = join(",", splice(@vals, 0, 36));
my $size  = join(",", splice(@vals, 0, 36));
my $fee  = join(",", splice(@vals, 0, 36));
$_ = "[$time,[$cnt],[$size],[$fee]],\n"'
.mode csv
.headers off
select * from mempool order by time;
EOF

