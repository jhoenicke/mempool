#!/bin/bash
# Push the samples mempoold appended to its samples file since the last
# successful push to the web server, one addlog.sh call per sample.
# mempoold runs this after each sample (-exec); a failed push is retried
# with the next sample.  The ssh connection is kept open between runs.

SAMPLES=${1:-/home/ethereum/mempool/samples.log}
REMOTE=ethereum@webserver
ADDLOG=mempool4/addlog.sh

PUSHED=$SAMPLES.pushed
SSH="ssh -o BatchMode=yes -o ServerAliveInterval=30
    -o ControlMaster=auto -o ControlPersist=yes -o ControlPath=~/.ssh/cm-%C"

offset=$(cat "$PUSHED" 2>/dev/null || echo 0)
# read skips an incomplete last line, it is pushed next time
tail -c +$((offset + 1)) "$SAMPLES" | while IFS= read -r line; do
    $SSH $REMOTE $ADDLOG <<< "$line" || exit 1
    offset=$((offset + ${#line} + 1))
    echo $offset > "$PUSHED.tmp" && mv "$PUSHED.tmp" "$PUSHED"
done
