#!/usr/bin/perl

use List::Util qw[min max];

my $SQLITE="sqlite3";
my $MYSQL="mysql";
my $MEMPOOLLOG="mempool.log";
my $MEMPOOLDB="mempool.s3db";
my $MYSQLMEMPOOLDB="btc_mempool";

my @feelimit=(0.0001,1,2,5,10,20,30,40,50,60,70,80,90,100,120,140,160,180,200,220,240,260,280,300,350,400,450,500,550,600,650,700,750,800,850,900,950,1000,1400,2000,3000,5000,7000,10000);
my @total=();
my @count=();
my @fees=();
my $time = time();
for ($i = 0; $i< @feelimit; $i++) {
    $total[$i] = 0;
    $count[$i] = 0;
    $fees[$i] = 0;
}
while(<>) {
    /"size": (\d+)/ and $size = $1;
    /"ancestorsize": (\d+)/ and $asize = $1;
    /"descendantsize": (\d+)/ and $dsize = $1;
    /"fee": (\d*\.\d+)/ and $fee = int($1*1e8 + .5);
    /"ancestorfees": (\d+)/ and $afees = $1;
    /"descendantfees": (\d+)/ and $dfees = $1;

    if (/},/) {
	$afpb = $afees / $asize;
	$tfpb = ($afees + $dfees - $fee) / ($asize + $dsize - $size);
	$fpb = $fee / $size;
	$feeperbyte = max($tfpb, min($fpb, $afpb));
	for ($i = 0; $i< @feelimit; $i++) {
	    if ($feeperbyte >= $feelimit[$i]) {
		$total[$i] += $size;
		$count[$i]++;
		$fees[$i] += $fee;
	    }
	}
    }
}
if ($count[0]) {
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
