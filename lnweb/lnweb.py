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
# Python, grpc and the credentials are loaded once instead of per
# request.  Waiting for settlement doesn't poll lnd: one SubscribeInvoices
# stream wakes up the waiting requests.  Concurrency and invoice creation
# are capped, so a flood of requests gets 503/429 answers instead of forking
# processes until the machine runs out of memory.

import argparse
import codecs
import collections
import hashlib
import ipaddress
import json
import os
import re
import sys
import threading
import time
import traceback
import urllib.request
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
CERT_CHECK_SECONDS = 10   # how often to look for a renewed tls.cert
LNURLP_REFRESH_SECONDS = 3600
LNURLP_RETRY_SECONDS = 60 # while the lnurlp file was never loaded
LNURLP_MAX_BYTES = 1 << 20

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
        with open(macaroon, 'rb') as f:
            macaroon_hex = codecs.encode(f.read(), 'hex')

        def metadata_callback(_context, callback):
            callback([('macaroon', macaroon_hex)], None)

        self.rpcserver = rpcserver
        self.tlscert = tlscert
        self.auth_creds = grpc.metadata_call_credentials(metadata_callback)
        self.cert = None
        self.cert_checked = 0
        self.stub_lock = threading.Lock()
        self.get_stub()

        # r_hash (hex) -> [Event, number of waiters]
        self.waiters = {}
        self.waiters_lock = threading.Lock()
        threading.Thread(target=self.subscribe, daemon=True).start()

    def get_stub(self):
        """The stub for the current tls.cert.  lnd renews its self-signed
        certificate on restart when it has expired; pick up the new one
        without a restart of this service."""
        with self.stub_lock:
            now = time.monotonic()
            if now - self.cert_checked >= CERT_CHECK_SECONDS:
                self.cert_checked = now
                try:
                    with open(self.tlscert, 'rb') as f:
                        cert = f.read()
                except OSError as e:
                    if self.cert is None:
                        raise
                    print("cannot read %s: %s" % (self.tlscert, e),
                          file=sys.stderr)
                    cert = self.cert
                if cert != self.cert:
                    if self.cert is not None:
                        print("tls.cert changed, reconnecting", file=sys.stderr)
                    creds = grpc.composite_channel_credentials(
                        grpc.ssl_channel_credentials(cert), self.auth_creds)
                    self.stub = lnrpc.LightningStub(
                        grpc.secure_channel(self.rpcserver, creds))
                    self.cert = cert
            return self.stub

    def add_invoice(self, **kwargs):
        return self.get_stub().AddInvoice(ln.Invoice(**kwargs),
                                          timeout=RPC_TIMEOUT)

    def is_settled(self, rhash):
        invoice = self.get_stub().LookupInvoice(
            ln.PaymentHash(r_hash_str=rhash), timeout=RPC_TIMEOUT)
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
                for invoice in self.get_stub().SubscribeInvoices(
                        ln.InvoiceSubscription()):
                    if invoice.state != ln.Invoice.SETTLED:
                        continue
                    rhash = invoice.r_hash.hex()
                    with self.waiters_lock:
                        entry = self.waiters.get(rhash)
                        if entry:
                            entry[0].set()
                print("invoice subscription ended, reconnecting",
                      file=sys.stderr)
            except grpc.RpcError as e:
                # e.g. lnd restarting; keep it to one line every 5 seconds
                print("invoice subscription failed: %s %s, reconnecting"
                      % (e.code(), e.details()), file=sys.stderr)
            except Exception:
                traceback.print_exc()
            time.sleep(5)


LnurlParams = collections.namedtuple(
    "LnurlParams", "descr_hash min_sendable max_sendable comment_allowed")


class LnurlPay:
    """The LNURL-pay parameters from the .well-known/lnurlp/ file.  The
    description hash must match the metadata the wallet got from there, so
    read it from the place wallets read it: a local file is loaded once, a
    URL is fetched in the background and refreshed periodically, keeping
    the last good copy when a fetch fails."""

    def __init__(self, source):
        self.source = source
        self.params = None
        if source.startswith("https://"):
            threading.Thread(target=self.refresh, daemon=True).start()
        elif "://" in source:
            raise ValueError("lnurlp URL must use https: " + source)
        else:
            with open(source, 'rb') as f:
                self.params = self.parse(f.read())

    def get(self):
        return self.params

    @staticmethod
    def parse(data):
        pay = json.loads(data)
        params = LnurlParams(
            descr_hash=hashlib.sha256(pay["metadata"].encode('utf-8')).digest(),
            min_sendable=int(pay["minSendable"]),
            max_sendable=int(pay["maxSendable"]),
            comment_allowed=int(pay.get("commentAllowed", 0)))
        if pay.get("tag") != "payRequest" or \
           not 0 < params.min_sendable <= params.max_sendable:
            raise ValueError("not a valid payRequest")
        return params

    def refresh(self):
        while True:
            try:
                with urllib.request.urlopen(self.source,
                                            timeout=RPC_TIMEOUT) as resp:
                    data = resp.read(LNURLP_MAX_BYTES + 1)
                if len(data) > LNURLP_MAX_BYTES:
                    raise ValueError("file too large")
                params = self.parse(data)
                if self.params is not None and params != self.params:
                    print("lnurlp metadata changed", file=sys.stderr)
                self.params = params
            except Exception as e:
                print("cannot load %s: %s: %s" % (self.source,
                      type(e).__name__, e), file=sys.stderr)
            time.sleep(LNURLP_REFRESH_SECONDS if self.params is not None
                       else LNURLP_RETRY_SECONDS)


class Service:
    def __init__(self, lnd, lnurlp):
        self.lnd = lnd
        self.invoice_limit = TokenBucket(INVOICE_RATE)
        self.global_invoice_limit = TokenBucket(GLOBAL_INVOICE_RATE)
        self.waiters = 0
        self.waiters_per_ip = {}
        self.waiters_per_hash = {}
        self.lock = threading.Lock()
        self.lnurlp = lnurlp

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
        pay = self.lnurlp.get()
        if pay is None:
            raise RequestError(503, "LNURL metadata not loaded yet")
        if not pay.min_sendable <= amount <= pay.max_sendable:
            raise RequestError(400, "Amount out of range")
        comment = form.get("comment", [""])[0]
        if len(comment) > pay.comment_allowed:
            raise RequestError(400, "Comment too long")
        memo = "Johoe's Mempool" + (" - " + comment if comment else "")
        self.check_rate(ip)
        invoice = self.lnd.add_invoice(memo=memo, value_msat=amount,
                                       description_hash=pay.descr_hash)
        return {"pr": invoice.payment_request, "routes": []}


def client_key(ip):
    """Key for the per-IP limits.  An IPv6 client usually owns a whole /64,
    so group by that; otherwise it could pick a fresh address per request."""
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return ip
    if addr.version == 6:
        if addr.ipv4_mapped:
            return str(addr.ipv4_mapped)
        return str(ipaddress.ip_network((addr, 64), strict=False))
    return str(addr)


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
        ip = client_key(forwarded.split(",")[-1].strip() or
                        self.client_address[0])
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
        # Refuse a body instead of reading it.
        if (self.headers.get("Content-Length", "0").strip() != "0" or
                "Transfer-Encoding" in self.headers):
            self.reply(400, {"status": "ERROR", "reason": "Unexpected body"})
            return
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
                        help="the .well-known/lnurlp/<name> file, "
                        "as local path or https URL")
    args = parser.parse_args()

    host, port = args.listen.rsplit(":", 1)
    service = Service(Lnd(args.rpcserver, args.tlscert, args.macaroon),
                      LnurlPay(args.lnurlp))
    Server((host, int(port)), service).serve_forever()


if __name__ == "__main__":
    main()
