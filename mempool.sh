#!/bin/bash

BITCOINCLI=/home/bitcoind/bin/bitcoin-cli
MEMPOOLHOME=/home/hoenicke/mempool
TMPFILE=/dev/shm/mempool/rawdump.txt
mkdir -p /dev/shm/mempool

cd $MEMPOOLHOME
rm -f $TMPFILE
$BITCOINCLI getrawmempool true > $TMPFILE
perl mempool-sql.pl < $TMPFILE

./mkdata.sh
