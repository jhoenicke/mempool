#!/usr/bin/env python3
import json
import sys
import time
from subprocess import PIPE, Popen

FEELIMIT = [0.0001, 1, 2, 3, 4, 5, 6, 7, 8, 10,
            12, 14, 17, 20, 25, 30, 40, 50, 60, 70, 80, 100,
            120, 140, 170, 200, 250, 300, 400, 500, 600, 700, 800, 1000,
            1200, 1400, 1700, 2000, 2500, 3000, 4000, 5000, 6000, 7000, 8000, 10000]
sizes = [0] * len(FEELIMIT)
count = [0] * len(FEELIMIT)
fees = [0] * len(FEELIMIT)
found = False

lastfrom = ""
lastgprice = 0

def parse_txdata(obj):
    global sizes, count, fees, found, lastfrom, lastgprice
    try:
        firstval = next(iter(obj.values()));
        if "gasPrice" in firstval:
            # effective gas price is the gas that miners use
            # to determine if to mine a transaction.  It is the
            # minimum of the gas price and the effective gas price
            # of the previous unconfirmed transaction with a smaller
            # nonce.  We set effgprice to a very large value initially, 
            # so that it doesn't effect the gas price of the first
            # trnasaction.
            effgprice = 1e18;
            # sort the txes by nonce
            for k in sorted(obj.keys(), key=int):
                tx = obj[k]
                gprice =  int(tx["gasPrice"], 0)
                gas = int(tx["gas"], 0)
                size = gas
                gprice = gprice / 1000000000
                effgprice = min(effgprice, gprice)

                found = True
                for i, limit in enumerate(FEELIMIT):
                    if (effgprice >= limit and
                            (i == len(FEELIMIT) - 1 or effgprice < FEELIMIT[i+1])):
                        sizes[i] += size
                        count[i] += 1
                        # Fees in ETH
                        fees[i] += round(gprice * gas)
                        break

            return None
        return obj
    except:
        return obj

def dump_data(timestamp, sizes, count, fees):
    sizesstr = ",".join(str(x) for x in sizes)
    countstr = ",".join(str(x) for x in count)
    feesstr = ",".join(str(x) for x in fees)
    print("[{:d},[{}],[{}],[{}]],"
          .format(timestamp, countstr, sizesstr, feesstr))

def main():
    global sizes, count, fees, found
    timestamp = int(time.time())
    try:
        output = json.load(sys.stdin, object_hook=parse_txdata)
    except:
        pass
    if found:
        dump_data(timestamp, sizes, count, fees)

main()
