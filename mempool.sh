#!/bin/bash

DESTDIR=/dev/shm/mempool-btc
BITCOINCLI=/home/bitcoin/bin/bitcoin-cli
MEMPOOLHOME=/home/mempool/mempool
TMPFILE=$DESTDIR/rawdump.txt
export DESTDIR MEMPOOLHOME

cd $MEMPOOLHOME

# create ram-disk directory if it does not exists.  /dev/shm is world
# writable, so another user could have created DESTDIR first and plant
# files that the web server delivers: create it without -p (fails if it
# exists) and refuse to use one that isn't ours or is writable by others.
if [ ! -e $DESTDIR ]; then
    mkdir -m 755 $DESTDIR || exit 1
    mkdir $DESTDIR/LOCK
    # read mempool.log once sequentially to quickly load it in buffers
    cat mempool.log > /dev/null
    ./mkdata.sh
    rmdir $DESTDIR/LOCK
fi

if [ -L $DESTDIR ] || [ ! -d $DESTDIR ] || [ ! -O $DESTDIR ] ||
       [ -n "$(find $DESTDIR -maxdepth 0 -perm /022)" ]; then
    echo "$DESTDIR is not a directory owned by and writable only by $(id -un)" >&2
    exit 1
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
