#!/bin/bash

DB=$1

mysql btc_mempool <<EOF | perl -pe 'chomp;s/NULL/0/g;
my @vals = map { $_ || 0 } (split "\t", $_, -1);
if ($vals[1] == 0 && $vals[2] == 0) {
   $vals[1] = $vals[3];
   $vals[2] = $vals[3];
}
if ($vals[1+44] == 0 && $vals[2+44] == 0) {
   $vals[1+44] = $vals[3+44];
   $vals[2+44] = $vals[3+44];
}
if ($vals[1+88] == 0 && $vals[2+88] == 0) {
   $vals[1+88] = $vals[3+88];
   $vals[2+88] = $vals[3+88];
}
my $time = shift @vals;
my $cnt  = join(",", splice(@vals, 0, 44));
my $size  = join(",", splice(@vals, 0, 44));
my $fee  = join(",", splice(@vals, 0, 44));
$_ = "[$time,[$cnt],[$size],[$fee]],\n"'
select * from mempool order by time;
EOF
