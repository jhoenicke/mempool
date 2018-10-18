#!/bin/bash

BITCOINCLI=/home/bitcoin/bin/bitcoin-cli
MEMPOOLHOME=/home/mempool/mempool
TMPFILE=/dev/shm/mempool-btc/rawdump.txt
mkdir -p /dev/shm/mempool-btc

cd $MEMPOOLHOME
rm -f $TMPFILE
$BITCOINCLI getrawmempool true > $TMPFILE
python3 mempool_sql.py < $TMPFILE

./mkdata.sh
