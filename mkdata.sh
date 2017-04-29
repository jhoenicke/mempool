#!/bin/bash

MEMPOOL=mempool.log
DESTDIR=/dev/shm/mempool
mkdir -p $DESTDIR

createfile() {
  NAME=$1
  MINUTES=$2
  (echo 'call(['; tail -$MINUTES $MEMPOOL; echo '])') > $DESTDIR/$NAME.js
}

createfilei() {
  NAME=$1
  MINUTES=$2
  IVAL=$3
  (echo 'call(['; tail -$MINUTES $MEMPOOL | sed -n '1~'$IVAL'p'; echo '])') > $DESTDIR/$NAME.js
}

createfileall() {
  NAME=all
  IVAL=$1
  (echo 'call(['; sed -n '1~'$IVAL'p' < $MEMPOOL; echo '])') > $DESTDIR/$NAME.js
}

createfile 2h 120
createfile 8h 480
createfile 24h 1440
createfilei 2d 2880 2
createfilei 4d 5760 4
createfilei 1w 10080 7
createfilei 2w 20160 14
createfilei 30d 43200 30
createfilei 3m 131040 90
createfileall 120
