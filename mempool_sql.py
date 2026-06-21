#!/usr/bin/env python3
import json
import decimal
import sys
import time
from subprocess import PIPE, Popen

MYSQL = "/usr/bin/mysql"
MEMPOOLLOG = "mempool.log"
MYSQLMEMPOOLDB = "btc_mempool"

FEELIMIT = [0.0001, 1, 2, 3, 4, 5, 6, 7, 8, 10,
            12, 14, 17, 20, 25, 30, 40, 50, 60, 70, 80, 100,
            120, 140, 170, 200, 250, 300, 400, 500, 600, 700, 800, 1000,
            1200, 1400, 1700, 2000, 2500, 3000, 4000, 5000, 6000, 7000, 8000, 10000]
sizes = [0] * len(FEELIMIT)
count = [0] * len(FEELIMIT)
fees = [0] * len(FEELIMIT)
found = False

def parse_txdata(obj):
    global sizes, count, fees, found
    if "fee" in obj or "fees" in obj:
        if "vsize" in obj:
            size = obj["vsize"]
        else:
            size = obj["size"]
        if "fees" in obj:
            fee = int(obj["fees"]["base"] * 100000000)
        else:
            fee = int(obj["fee"]*100000000)
        if "ancestorsize" in obj:
            asize = obj["ancestorsize"]
            if "fees" in obj:
                afees = int(obj["fees"]["ancestor"] * 100000000)
            else:
                afees = obj["ancestorfees"]
        else:
            asize = size
            afees = fee
        if "descendantsize" in obj:
            dsize = obj["descendantsize"]
            if "fees" in obj:
                dfees = int(obj["fees"]["descendant"] * 100000000)
            else:
                dfees = obj["descendantfees"]
        else:
            dsize = size
            dfees = fee

        afpb = afees / asize  # ancestor fee (includes current)
        fpb = fee / size      # current fee
        dfpb = dfees / dsize  # descendant fee (includes current)
        # total average fee for mining all ancestors and descendants.
        tfpb = (afees + dfees - fee) / (asize + dsize - size)
        feeperbyte = max(min(dfpb, tfpb), min(fpb, afpb))

        found = True
        for i, limit in enumerate(FEELIMIT):
            if (feeperbyte >= limit and
                    (i == len(FEELIMIT) - 1 or feeperbyte < FEELIMIT[i+1])):
                sizes[i] += size
                count[i] += 1
                fees[i] += fee
                break
        return None
    return obj

def res_level(timestamp):
    # Coarsest sampling level this row belongs to, over a nested ladder of
    # minute steps (each divides the next).  Part of the (res, time) primary
    # key so db.php can read a given resolution sequentially; see db.php.
    minute = timestamp // 60
    if minute % 1440 == 0:
        return 5
    if minute % 360 == 0:
        return 4
    if minute % 60 == 0:
        return 3
    if minute % 10 == 0:
        return 2
    if minute % 2 == 0:
        return 1
    return 0

def dump_data(timestamp, sizes, count, fees):
    sizesstr = ",".join(str(x) for x in sizes)
    countstr = ",".join(str(x) for x in count)
    feesstr = ",".join(str(x) for x in fees)
    with open(MEMPOOLLOG, "a") as logfile:
        logfile.write("[{:d},[{}],[{}],[{}]],\n"
                      .format(timestamp, countstr, sizesstr, feesstr))
    proc = Popen([MYSQL, MYSQLMEMPOOLDB], stdin=PIPE, stdout=PIPE)
    proc.communicate("INSERT INTO mempool VALUES({:d},{},{},{},{:d});\n"
                     .format(timestamp, countstr, sizesstr, feesstr,
                             res_level(timestamp))
                     .encode("ascii"))

def main():
    global sizes, count, fees, found
    timestamp = int(time.time())
    json.load(sys.stdin, object_hook=parse_txdata, parse_float=decimal.Decimal)
    if found:
        dump_data(timestamp, sizes, count, fees)

main()
