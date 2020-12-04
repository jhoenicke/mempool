#!/usr/bin/perl

use List::Util qw(min);

@FEELIMIT = (0, 1, 2, 3, 4, 5, 6, 7, 8, 10,
            12, 14, 17, 20, 25, 30, 40, 50, 60, 70, 80, 100,
            120, 140, 170, 200, 250, 300, 400, 500, 600, 700, 800, 1000,
            1200, 1400, 1700, 2000, 2500, 3000, 4000, 5000, 6000, 7000, 8000, 10000);


sub findslice($) {
    my $gasprice = $_[0];
    my $low = 0; 
    my $high = $#FEELIMIT;
    while ($low < $high) {
	my $mid = int(($low + $high + 1) / 2);
	if ($gasprice >= $FEELIMIT[$mid]) {
	    $low = $mid;
	} else {
	    $high = $mid - 1;
        }
    }
    return $low;
}

@sizes = (0) x @FEELIMIT;
@count = (0) x @FEELIMIT;
@fees = (0) x @FEELIMIT;

%tx = ();

while (<>) {
    if ($_ =~ /(\d+):\s*\"0x[0-9a-fA-F]*:\s*\d+\s*wei [^ ]* (\d+)\s*gas [^ ]* (\d+) wei\"/) {
	$nonce = int($1);
	$gas = int($2);
	$gasprice = int($3);
	$tx{$nonce} = [$gas, $gasprice/1e9];
    }
    elsif (/\}\,/) {
	$effgprice = 1e18;
	for $k (sort {$a <=> $b} (keys(%tx))) {
            $gas = $tx{$k}[0];
	    $gasprice = $tx{$k}[1];
	    $effgprice = min($effgprice, $gasprice);
	    $slice = findslice($effgprice);
	    $count[$slice] += 1;
	    $sizes[$slice] += $gas;
	    $fees[$slice] += $gas*$gasprice;
	}
	%tx = ();
   }
}


$timestamp = time();
$counts = join(",", @count);
$sizes = join(",", @sizes);
$fees = join(",", map(int, @fees));

print "[$timestamp,[$counts],[$sizes],[$fees]],\n"
