#!/bin/bash

DESTDIR=/dev/shm/mempool-btc
BITCOINCLI=/home/bitcoin/bin/bitcoin-cli
MEMPOOLHOME=/home/mempool/mempool
TMPFILE=$DESTDIR/rawdump.txt
export DESTDIR MEMPOOLHOME

cd $MEMPOOLHOME

# create ram-disk directory if it does not exists
if [ ! -e $DESTDIR ]; then
    mkdir -p $DESTDIR/LOCK
    # read mempool.log once sequentially to quickly load it in buffers
    cat mempool.log > /dev/null
    ./mkdata.sh
    rmdir $DESTDIR/LOCK
fi

# create mempool statistics, protected by LOCK
if ! mkdir $DESTDIR/LOCK 2>/dev/null; then
    exit
fi
$BITCOINCLI getrawmempool true > $TMPFILE
python3 mempool_sql.py < $TMPFILE
rmdir $DESTDIR/LOCK

# update ram-disk directory, protected by DATALOCK
if ! mkdir $DESTDIR/DATALOCK 2>/dev/null; then
    exit
fi
./updatedata.sh
rmdir $DESTDIR/DATALOCK
