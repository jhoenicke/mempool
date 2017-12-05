#!/bin/bash

DB=$1

mysql btc_mempool <<EOF | perl -pe 'chomp;s/NULL/0/g;
my $feelevels=46
my @vals = map { $_ || 0 } (split "\t", $_, -1);
my $time = shift @vals;
my $cnt  = join(",", splice(@vals, 0, $feelevels));
my $size  = join(",", splice(@vals, 0, $feelevels));
my $fee  = join(",", splice(@vals, 0, $feelevels));
$_ = "[$time,[$cnt],[$size],[$fee]],\n"'
select * from mempool order by time;
EOF
