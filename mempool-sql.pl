#!/usr/bin/perl

use List::Util qw[min max];

my $SQLITE="sqlite3";
my $MYSQL="mysql";
my $MEMPOOLLOG="mempool.log";
my $MYSQLMEMPOOLDB="btc_mempool";

my @feelimit=(0.0001,1,2,3,4,5,6,7,8,10,12,14,17,20,25,30,40,50,60,70,80,100,120,140,170,200,250,300,400,500,600,700,800,1000,1200,1400,1700,2000,2500,3000,4000,5000,6000,7000,8000,10000,2100000000000000);
my @total=();
my @count=();
my @fees=();
my $time = time();
for ($i = 0; $i< @feelimit - 1; $i++) {
    $total[$i] = 0;
    $count[$i] = 0;
    $fees[$i] = 0;
}
my $found = 0;
while(<>) {
    /"size": (\d+)/ and $size = $1;
    /"ancestorsize": (\d+)/ and $asize = $1;
    /"descendantsize": (\d+)/ and $dsize = $1;
    /"fee": (\d*\.\d+)/ and $fee = int($1*1e8 + .5);
    /"ancestorfees": (\d+)/ and $afees = $1;
    /"descendantfees": (\d+)/ and $dfees = $1;

    if (/},/) {
	$afpb = $afees / $asize; # ancestor fee (includes current)
	$fpb = $fee / $size;     # current fee
	$dfpb = $dfees / $dsize; # descendant fee (includes current)
	# total average fee for mining all ancestors and descendants.
	$tfpb = ($afees + $dfees - $fee) / ($asize + $dsize - $size);
	# the "min"s ensure we take the fee level of ancestors in account
	# if and only if they pay less (like a miner would do).
	# the "max" ensures we take the descendants into account for CPFP.
	$feeperbyte = max(min($dfpb, $tfpb), min($fpb, $afpb));
	for ($i = 0; $i< @feelimit-1; $i++) {
	    if ($feeperbyte >= $feelimit[$i] && $feeperbyte < $feelimit[$i+1]) {
		$total[$i] += $size;
		$count[$i]++;
		$fees[$i] += $fee;
	    }
	}
	$found = 1;
    }
}
if ($found) {
    my $cnt  = join(",", @count);
    my $size = join(",", @total);
    my $fee  = join(",", @fees);
    open(LOG, ">>$MEMPOOLLOG");
    print LOG "[$time,[$cnt],[$size],[$fee]],\n";
    close(LOG);
    open(SQL, "|$MYSQL $MYSQLMEMPOOLDB");
    $line = "INSERT INTO mempool VALUES($time,$cnt,$size,$fee);\n";
    print SQL $line;
    close SQL;
}
