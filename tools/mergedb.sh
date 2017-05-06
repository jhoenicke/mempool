#!/bin/bash

MERGESQL=/dev/shm/merge.sql

if [ -z "$4" ]; then
    echo "USAGE: ./mergedb.sh db1 db2 start end"
    echo "Merges entries between start and end time from db1 into db2."
    echo "  db1: source db"
    echo "  db2: destination db"
    echo "  start: start time (date compatible)"
    echo "  end: end time (date compatible)"
    exit 1
fi

SRC=$1
DEST=$2
START=`date --date "$3" +%s`
if [ $? != 0 ]; then
    echo "Cannot parse start date"
    exit 1
fi
END=`date --date $4 +%s`
if [ $? != 0 ]; then
    echo "Cannot parse end date"
    exit 1
fi
let END+=30

echo "BEGIN TRANSACTION;" >> $MERGESQL
echo "DELETE FROM mempool WHERE time >= $START AND time <= $END;" >> $MERGESQL
sqlite3 $SRC >> $MERGESQL <<EOF
.mode insert mempool
SELECT * FROM MEMPOOL WHERE time >= $START AND time <= $END;
EOF
echo "COMMIT;" >> $MERGESQL

less $MERGESQL

echo -n "Looks okay? "
read answer
case "$answer" in
     y*|j*) sqlite3 $DEST < $MERGESQL; echo "Done";;
esac
rm $MERGESQL
