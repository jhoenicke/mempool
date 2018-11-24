#!/bin/bash

# update the JSON files delivering the summarized mempool
#
# LINE is set to the last line in mempool.
# for each file:
#   check if current minute divisible by IVAL
#   if divisible:
#      remove first line (after 'call([').
#      add LINE to this file (before last line '])').

MEMPOOL=mempool.log
LINE=`tail -1 $MEMPOOL`
SECOND=`date +%s`
MINUTE=`expr $SECOND / 60`

updatefile() {
  NAME=$1
  MINUTES=$2
  IVAL=$3
  if [ `expr $MINUTE % $IVAL` -eq "0" ]; then
    (echo 'call(['; tail -n +3 $DESTDIR/$NAME.js | head -n -1; echo "$LINE"; echo '])') > $DESTDIR/$NAME.js.new
    mv $DESTDIR/$NAME.js.new $DESTDIR/$NAME.js
  fi
}

updatefile_all() {
  NAME=all
  IVAL=$1
  if [ `expr $MINUTE % $IVAL` -eq "0" ]; then
    (head -n -1 $DESTDIR/$NAME.js; echo "$LINE"; echo '])') > $DESTDIR/$NAME.js.new
    mv $DESTDIR/$NAME.js.new $DESTDIR/$NAME.js
  fi
}

updatefile 2h 120 1
updatefile 8h 480 1
updatefile 24h 1440 1
updatefile 2d 2880 2
updatefile 4d 5760 4
updatefile 1w 10080 7
updatefile 2w 20160 14
updatefile 30d 43200 30
updatefile 3m 131040 90
updatefile 6m 262080 180
updatefile 1y 524160 360
updatefile_all 360
