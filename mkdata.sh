#!/bin/bash

MEMPOOL=mempool.log
DESTDIR=/dev/shm/mempool-btc
mkdir -p $DESTDIR

createfile() {
  (echo 'call(['; eval "$CMD"; echo '])') > $DESTDIR/$NAME.js.new
  mv $DESTDIR/$NAME.js.new $DESTDIR/$NAME.js
}

createfile_unfiltered() {
  NAME=$1
  MINUTES=$2
  CMD="tail -$MINUTES $MEMPOOL"
  createfile
}

createfile_filtered() {
  NAME=$1
  MINUTES=$2
  IVAL=$3
  CMD="tail -$MINUTES $MEMPOOL | sed -n '1~${IVAL}p'"
  createfile
}

createfile_all() {
  NAME=all
  IVAL=$1
  CMD="sed -n '1~${IVAL}p' < $MEMPOOL"
  createfile
}

createfile_unfiltered 2h 120
createfile_unfiltered 8h 480
createfile_unfiltered 24h 1440
createfile_filtered 2d 2880 2
createfile_filtered 4d 5760 4
createfile_filtered 1w 10080 7
createfile_filtered 2w 20160 14
createfile_filtered 30d 43200 30
createfile_filtered 3m 131040 90
createfile_filtered 6m 262080 180
createfile_filtered 1y 524160 360
createfile_all 360
