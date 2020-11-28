#!/bin/bash

DESTDIR=/dev/shm/mempool-eth
MEMPOOLHOME=/home/ethereum/mempool
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
LINE=$(geth --exec "txpool.content" attach | \
	perl -pe 's/^(\s*)([a-zA-Z0-9]*):(.*)/$1"$2":$3/' | \
	jq '.pending' | \
	python3 txpool_parse.py)

echo $LINE >> mempool.log
(
    echo -n "INSERT INTO mempool VALUES("
    echo -n $LINE | tr -d '[]' | cut -d, -f1-139
    echo ");"
) | /usr/bin/mysql eth_mempool

rmdir $DESTDIR/LOCK

# update ram-disk directory, protected by DATALOCK
if ! mkdir $DESTDIR/DATALOCK 2>/dev/null; then
    exit
fi
./updatedata.sh
rmdir $DESTDIR/DATALOCK
