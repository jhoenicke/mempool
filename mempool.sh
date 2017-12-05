#!/bin/bash

BITCOINCLI=/home/bitcoin/bin/bitcoin-cli
MEMPOOLHOME=/home/mempool/mempool
TMPFILE=/dev/shm/mempool-btc/rawdump.txt
mkdir -p /dev/shm/mempool-btc

cd $MEMPOOLHOME
rm -f $TMPFILE
$BITCOINCLI getrawmempool true > $TMPFILE
perl mempool-sql.pl < $TMPFILE

./mkdata.sh
