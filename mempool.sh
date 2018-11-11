#!/bin/bash

DESTDIR=/dev/shm/mempool-btc
BITCOINCLI=/home/bitcoin/bin/bitcoin-cli
MEMPOOLHOME=/home/mempool/mempool
TMPFILE=$DESTDIR/rawdump.txt

export DESTDIR MEMPOOLHOME
mkdir -p $DESTDIR
cd $MEMPOOLHOME

if ! mkdir $DESTDIR/LOCK 2>/dev/null; then
  exit
fi
$BITCOINCLI getrawmempool true > $TMPFILE
python3 mempool_sql.py < $TMPFILE
rmdir $DESTDIR/LOCK

if ! mkdir $DESTDIR/DATALOCK 2>/dev/null; then
  exit
fi
./mkdata.sh
rmdir $DESTDIR/DATALOCK
