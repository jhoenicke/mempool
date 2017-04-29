#!/bin/bash

BITCOINCLI=/home/bitcoind/bin/bitcoin-cli
MEMPOOLHOME=/home/mempool/mempool

cd $MEMPOOLHOME
$BITCOINCLI getrawmempool true | perl mempool-sql.pl

./mkdata.sh
