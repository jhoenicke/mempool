package main

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"strconv"
	"time"
)

const hookTimeout = 10 * time.Minute

// sampleLocked formats the current statistics as a mempool.log line.
// The caller holds d.mu.
func (d *daemon) sampleLocked(timestamp int64) string {
	count, size, fees := d.pool.stats()
	return fmt.Sprintf("[%d,[%s],[%s],[%s]],\n", timestamp,
		join(count), join(size), join(fees))
}

// lastSampleMinute returns the minute of the last sample in the samples
// file, so a restart doesn't sample the same minute twice.
func lastSampleMinute(path string) int64 {
	f, err := os.Open(path)
	if err != nil {
		return 0
	}
	defer f.Close()
	buf := make([]byte, 4096)
	end, err := f.Seek(0, io.SeekEnd)
	if err != nil {
		return 0
	}
	n, _ := f.ReadAt(buf, max(0, end-int64(len(buf))))
	buf = bytes.TrimRight(buf[:n], "\n")
	line := buf[bytes.LastIndexByte(buf, '\n')+1:]
	field, _, _ := bytes.Cut(bytes.TrimPrefix(line, []byte("[")), []byte(","))
	timestamp, _ := strconv.ParseInt(string(field), 10, 64)
	return timestamp / 60
}

// writeSample appends a sample to the samples file and runs the hook.
func (d *daemon) writeSample(sample string) {
	f, err := os.OpenFile(d.samples, os.O_WRONLY|os.O_APPEND|os.O_CREATE, 0644)
	if err == nil {
		_, err = f.WriteString(sample)
		if cerr := f.Close(); err == nil {
			err = cerr
		}
	}
	if err != nil {
		log.Printf("writing sample: %v", err)
		return
	}
	if d.hook != "" {
		d.runHook()
	}
}

// runHook runs the hook in the background.  If it is still running from
// the previous sample, it is run once more after it finishes.
func (d *daemon) runHook() {
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.hookRunning {
		d.hookAgain = true
		return
	}
	d.hookRunning = true
	go func() {
		for {
			ctx, cancel := context.WithTimeout(context.Background(), hookTimeout)
			cmd := exec.CommandContext(ctx, "/bin/sh", "-c", d.hook)
			// No pipes: an ssh ControlPersist master inherits them and
			// would keep us waiting until it exits.
			cmd.Stdout, cmd.Stderr = os.Stderr, os.Stderr
			if err := cmd.Run(); err != nil {
				log.Printf("%s: %v", d.hook, err)
			}
			cancel()
			d.mu.Lock()
			if !d.hookAgain {
				d.hookRunning = false
				d.mu.Unlock()
				return
			}
			d.hookAgain = false
			d.mu.Unlock()
		}
	}()
}
