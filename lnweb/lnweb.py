#!/usr/bin/env python3
#
#   Lightning donation backend for Johoe's Mempool
#   Copyright (C) 2018-2026  Jochen Hoenicke
#
#   This program is free software: you can redistribute it and/or modify
#   it under the terms of the GNU Affero General Public License as
#   published by the Free Software Foundation, either version 3 of the
#   License, or (at your option) any later version.
#
#   This program is distributed in the hope that it will be useful,
#   but WITHOUT ANY WARRANTY; without even the implied warranty of
#   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#   GNU Affero General Public License for more details.
#
#   You should have received a copy of the GNU Affero General Public License
#   along with this program.  If not, see <http://www.gnu.org/licenses/>.
#
# Long-running replacement for the old per-request CGI scripts in web/lnd/.
# The web server proxies /lnd/ to this service (see web/lightning/README.md),
# so the URLs and JSON answers stay the same:
#
#   /lnd/invoice.py?memo=..&value=..     create invoice (value in sat)
#   /lnd/check-invoice.py?r_hash=..      long-poll until settled or timeout
#   /lnd/lnurl.py?amount=..&comment=..   LNURL-pay callback (amount in msat)
#
# Python, grpc, the TLS cert and the macaroon are loaded once instead of per
# request.  Waiting for settlement doesn't poll lnd: one SubscribeInvoices
# stream wakes up the waiting requests.  Concurrency and invoice creation
# are capped, so a flood of requests gets 503/429 answers instead of forking
# processes until the machine runs out of memory.

import argparse
import codecs
import hashlib
import json
import os
import re
import sys
import threading
import time
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit

import grpc
import lightning_pb2 as ln
import lightning_pb2_grpc as lnrpc

MAX_THREADS = 200         # concurrent requests in total
MAX_WAITERS = 150         # of those, long-polling check-invoice requests
MAX_WAITERS_PER_IP = 4
MAX_WAITERS_PER_HASH = 2  # the page waits once per invoice; allow a reload
WAIT_SECONDS = 60         # long-poll duration of check-invoice
RPC_TIMEOUT = 10          # seconds for unary lnd calls
INVOICE_RATE = 10         # invoices per IP and minute (also the burst size)
GLOBAL_INVOICE_RATE = 120 # invoices per minute in total
MAX_VALUE_SAT = 4294967   # same limit as web/lightning/index.html
MAX_MEMO_BYTES = 400

RHASH_RE = re.compile(r"^[0-9a-f]{64}$")


class RequestError(Exception):
    def __init__(self, status, reason):
        super().__init__(reason)
        self.status = status
        self.reason = reason


class TokenBucket:
    """Per-key token buckets refilling at rate/minute, burst = rate."""

    def __init__(self, rate):
        self.rate = rate
        self.buckets = {}
        self.lock = threading.Lock()

    def take(self, key):
        now = time.monotonic()
        with self.lock:
            tokens, last = self.buckets.get(key, (self.rate, now))
            tokens = min(self.rate, tokens + (now - last) * self.rate / 60)
            if tokens < 1:
                self.buckets[key] = (tokens, now)
                return False
            self.buckets[key] = (tokens - 1, now)
            if len(self.buckets) > 10000:
                # forget keys that have refilled completely
                cutoff = now - 60
                self.buckets = {k: v for k, v in self.buckets.items()
                                if v[1] > cutoff}
            return True


class Lnd:
    def __init__(self, rpcserver, tlscert, macaroon):
        # lnd generates ECDSA certificates, grpc needs the matching suite.
        os.environ["GRPC_SSL_CIPHER_SUITES"] = 'HIGH+ECDSA'
        with open(tlscert, 'rb') as f:
            cert = f.read()
        with open(macaroon, 'rb') as f:
            macaroon_hex = codecs.encode(f.read(), 'hex')

        def metadata_callback(_context, callback):
            callback([('macaroon', macaroon_hex)], None)

        creds = grpc.composite_channel_credentials(
            grpc.ssl_channel_credentials(cert),
            grpc.metadata_call_credentials(metadata_callback))
        self.stub = lnrpc.LightningStub(grpc.secure_channel(rpcserver, creds))

        # r_hash (hex) -> [Event, number of waiters]
        self.waiters = {}
        self.waiters_lock = threading.Lock()
        threading.Thread(target=self.subscribe, daemon=True).start()

    def add_invoice(self, **kwargs):
        return self.stub.AddInvoice(ln.Invoice(**kwargs), timeout=RPC_TIMEOUT)

    def is_settled(self, rhash):
        invoice = self.stub.LookupInvoice(ln.PaymentHash(r_hash_str=rhash),
                                          timeout=RPC_TIMEOUT)
        return invoice.state == ln.Invoice.SETTLED

    def wait_settled(self, rhash, timeout):
        # Register before the lookup, so a settlement in between isn't missed.
        with self.waiters_lock:
            entry = self.waiters.setdefault(rhash, [threading.Event(), 0])
            entry[1] += 1
        try:
            if self.is_settled(rhash):
                return True
            entry[0].wait(timeout)
            # Ask lnd again; this also covers a broken subscription stream.
            return self.is_settled(rhash)
        finally:
            with self.waiters_lock:
                entry[1] -= 1
                if entry[1] == 0:
                    del self.waiters[rhash]

    def subscribe(self):
        while True:
            try:
                for invoice in self.stub.SubscribeInvoices(
                        ln.InvoiceSubscription()):
                    if invoice.state != ln.Invoice.SETTLED:
                        continue
                    rhash = invoice.r_hash.hex()
                    with self.waiters_lock:
                        entry = self.waiters.get(rhash)
                        if entry:
                            entry[0].set()
            except Exception:
                traceback.print_exc()
            time.sleep(5)


class Service:
    def __init__(self, lnd, lnurlp):
        self.lnd = lnd
        self.invoice_limit = TokenBucket(INVOICE_RATE)
        self.global_invoice_limit = TokenBucket(GLOBAL_INVOICE_RATE)
        self.waiters = 0
        self.waiters_per_ip = {}
        self.waiters_per_hash = {}
        self.lock = threading.Lock()

        # The LNURL metadata must be byte-identical to what the wallet got
        # from .well-known/lnurlp/, so read it from there.
        with open(lnurlp) as f:
            pay = json.load(f)
        self.lnurl_metadata = pay["metadata"]
        self.lnurl_descr_hash = hashlib.sha256(
            self.lnurl_metadata.encode('utf-8')).digest()
        self.lnurl_min = pay["minSendable"]
        self.lnurl_max = pay["maxSendable"]
        self.lnurl_comment = pay.get("commentAllowed", 0)

    def check_rate(self, ip):
        if not self.invoice_limit.take(ip) or \
           not self.global_invoice_limit.take(""):
            raise RequestError(429, "Too many invoices, try again later")

    def invoice(self, ip, form):
        value = parse_int(form, "value", 0)
        memo = form.get("memo", [""])[0]
        if not 0 <= value <= MAX_VALUE_SAT:
            raise RequestError(400, "Amount out of range")
        if len(memo.encode('utf-8')) > MAX_MEMO_BYTES:
            raise RequestError(400, "Memo too long")
        self.check_rate(ip)
        invoice = self.lnd.add_invoice(memo=memo, value=value)
        return {"r_hash": invoice.r_hash.hex(),
                "payment_request": invoice.payment_request,
                "add_index": invoice.add_index}

    def check_invoice(self, ip, form):
        rhash = form.get("r_hash", [""])[0]
        if not RHASH_RE.match(rhash):
            raise RequestError(400, "Invalid r_hash")
        # Over any waiter limit, answer right away instead of refusing: the
        # page then polls every few seconds and still sees the payment.
        with self.lock:
            wait = (self.waiters < MAX_WAITERS and
                    self.waiters_per_ip.get(ip, 0) < MAX_WAITERS_PER_IP and
                    self.waiters_per_hash.get(rhash, 0) < MAX_WAITERS_PER_HASH)
            if wait:
                self.waiters += 1
                count_up(self.waiters_per_ip, ip)
                count_up(self.waiters_per_hash, rhash)
        if not wait:
            return {"settled": self.lnd.is_settled(rhash)}
        try:
            settled = self.lnd.wait_settled(rhash, WAIT_SECONDS)
        finally:
            with self.lock:
                self.waiters -= 1
                count_down(self.waiters_per_ip, ip)
                count_down(self.waiters_per_hash, rhash)
        return {"settled": settled}

    def lnurl(self, ip, form):
        amount = parse_int(form, "amount", None)
        if amount is None:
            raise RequestError(400, "Missing amount")
        if not self.lnurl_min <= amount <= self.lnurl_max:
            raise RequestError(400, "Amount out of range")
        comment = form.get("comment", [""])[0]
        if len(comment) > self.lnurl_comment:
            raise RequestError(400, "Comment too long")
        memo = "Johoe's Mempool" + (" - " + comment if comment else "")
        self.check_rate(ip)
        invoice = self.lnd.add_invoice(memo=memo, value_msat=amount,
                                       description_hash=self.lnurl_descr_hash)
        return {"pr": invoice.payment_request, "routes": []}


def count_up(counts, key):
    counts[key] = counts.get(key, 0) + 1


def count_down(counts, key):
    counts[key] -= 1
    if counts[key] == 0:
        del counts[key]


def parse_int(form, key, default):
    if key not in form:
        return default
    try:
        return int(form[key][0])
    except ValueError:
        raise RequestError(400, "Invalid " + key)


class Handler(BaseHTTPRequestHandler):
    timeout = 15  # for reading the request; check-invoice waits longer

    def route(self):
        url = urlsplit(self.path)
        form = parse_qs(url.query)
        # lighttpd's mod_proxy adds the client address as last entry.
        forwarded = self.headers.get("X-Forwarded-For", "")
        ip = forwarded.split(",")[-1].strip() or self.client_address[0]
        try:
            if url.path == "/lnd/invoice.py":
                self.reply(200, self.server.service.invoice(ip, form))
            elif url.path == "/lnd/check-invoice.py":
                self.reply(200, self.server.service.check_invoice(ip, form))
            elif url.path == "/lnd/lnurl.py":
                self.reply(200, self.server.service.lnurl(ip, form))
            else:
                self.reply(404, {"status": "ERROR", "reason": "Not found"})
        except RequestError as e:
            self.reply(e.status, {"status": "ERROR", "reason": e.reason})
        except grpc.RpcError as e:
            if e.code() == grpc.StatusCode.NOT_FOUND:
                self.reply(404, {"status": "ERROR", "reason": "Not found"})
            else:
                traceback.print_exc()
                self.reply(502, {"status": "ERROR", "reason": "lnd error"})

    def do_GET(self):
        self.route()

    def do_POST(self):
        # The page POSTs with an empty body; all parameters are in the URL.
        length = int(self.headers.get("Content-Length") or 0)
        if length > 0:
            self.rfile.read(min(length, 65536))
        self.route()

    def reply(self, status, obj):
        body = json.dumps(obj).encode('utf-8')
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=UTF-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        if status in (429, 503):
            self.send_header("Retry-After", "10")
        self.end_headers()
        self.wfile.write(body)

    def log_request(self, code='-', size='-'):
        pass  # the web server keeps the access log

    def log_error(self, format, *args):
        sys.stderr.write("%s: %s\n" % (self.address_string(), format % args))


class Server(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, address, service):
        super().__init__(address, Handler)
        self.service = service
        self.slots = threading.BoundedSemaphore(MAX_THREADS)

    def process_request(self, request, client_address):
        if not self.slots.acquire(blocking=False):
            try:
                request.sendall(b"HTTP/1.0 503 Service Unavailable\r\n"
                                b"Retry-After: 10\r\n"
                                b"Content-Length: 0\r\n\r\n")
            except OSError:
                pass
            self.shutdown_request(request)
            return
        try:
            super().process_request(request, client_address)
        except Exception:
            self.slots.release()
            raise

    def process_request_thread(self, request, client_address):
        try:
            super().process_request_thread(request, client_address)
        finally:
            self.slots.release()


def main():
    lnddir = "/home/lnd/.lnd"
    parser = argparse.ArgumentParser()
    parser.add_argument("--listen", default="127.0.0.1:8089",
                        help="address:port to listen on")
    parser.add_argument("--rpcserver", default="localhost:10009")
    parser.add_argument("--tlscert", default=lnddir + "/tls.cert")
    parser.add_argument("--macaroon", default=lnddir +
                        "/data/chain/bitcoin/mainnet/invoice.macaroon")
    parser.add_argument("--lnurlp", required=True,
                        help="the .well-known/lnurlp/<name> file")
    args = parser.parse_args()

    host, port = args.listen.rsplit(":", 1)
    service = Service(Lnd(args.rpcserver, args.tlscert, args.macaroon),
                      args.lnurlp)
    Server((host, int(port)), service).serve_forever()


if __name__ == "__main__":
    main()
