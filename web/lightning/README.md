Johoe's lightning setup
=======================

The service `lnweb/lnweb.py` connects to an instance of lnd running on the
current machine and handles invoices for the donation page and LNURL-pay.  It
mostly follows the lnd grpc tutorial for python.  It replaces the old CGI
scripts in web/lnd/: a CGI starts a new python process per request, so a flood
of requests (especially long-polling `check-invoice.py`) could exhaust the
memory of the machine.  The service loads grpc and the credentials once,
caps the number of concurrent requests and the invoice creation rate, and
waits for settlement on a single `SubscribeInvoices` stream.  The URLs
(`/lnd/invoice.py`, `/lnd/check-invoice.py`, `/lnd/lnurl.py`) and the JSON
answers are unchanged.

To use, follow the directions from the [lnd documentation][1] and setup
python in a virtualenv.  I copied the `rpc_pb*` files into the site-packages
directory of the virtual environment.

Run the service as its own user that can read nothing of lnd but a
restricted macaroon and the TLS certificate, and install the code so that
this user cannot modify it:

```
sudo useradd --system --no-create-home --shell /usr/sbin/nologin lnweb
sudo install -d -m 755 /usr/local/lib/lnweb
sudo install -m 644 lnweb/lnweb.py /usr/local/lib/lnweb/
sudo install -d -m 750 -g lnweb /etc/lnweb
sudo -u lnd -H lncli \
    --macaroonpath /home/lnd/.lnd/data/chain/bitcoin/mainnet/admin.macaroon \
    bakemacaroon --save_to /tmp/lnweb.macaroon \
    uri:/lnrpc.Lightning/AddInvoice uri:/lnrpc.Lightning/LookupInvoice \
    uri:/lnrpc.Lightning/SubscribeInvoices
sudo install -m 640 -g lnweb /tmp/lnweb.macaroon /etc/lnweb/lnweb.macaroon
sudo rm /tmp/lnweb.macaroon
sudo setfacl -m u:lnweb:x /home/lnd /home/lnd/.lnd
sudo install -m 644 lnweb/lnweb.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now lnweb
```

If `bakemacaroon` fails with "permission denied", the admin macaroon is
probably older than lnd 0.9 and lacks the `macaroon:generate` permission
(check with `lncli printmacaroon --macaroon_file ...`).  lnd never
regenerates existing macaroon files: stop lnd, move all `*.macaroon` files
and `macaroons.db` out of the directory and restart it.  This also creates a
new root key, so all previously issued macaroons become invalid.

Adjust the paths in `lnweb.service` (python from the virtualenv, the
`.well-known/lnurlp/` URL) to your setup.  The `lnweb` user needs read
access to the virtualenv.

The service reads `tls.cert` directly from lnd's directory and checks every
few seconds whether it changed, so when lnd regenerates its self-signed
certificate (it does so on startup once the old one expired), the service
picks it up without anything to copy or restart.  The `setfacl` above lets
`lnweb` only traverse the two directories, without listing them; it can
read `tls.cert` because lnd creates it world readable, but nothing else,
since lnd keeps `tls.key`, the macaroons and `data/` private.  Without ACL
support, `chmod o+x` on both directories works too, for all users.  Make
sure `admin.macaroon`, `tls.key` and `wallet.db` are only readable by lnd;
`invoice.macaroon` doesn't need to be readable by anyone else either.

The LNURL metadata is fetched from the `.well-known/lnurlp/` URL that
wallets use, so the description hash in the invoices always matches what
the wallet got, even if the file is served from another server.  It is
refetched every hour; if a fetch fails, the last good copy stays in use.
`--lnurlp` also accepts a local file, which is read once at startup.

Then let the web server forward `/lnd/` to the service.  I use lighttpd with:

```
server.modules += ( "mod_proxy" )

$HTTP["url"] =~ "^/lnd/" {
    proxy.server = ( "" => (( "host" => "127.0.0.1", "port" => 8089 )) )
}
```

The service enforces its per-client limits itself (IPv6 clients are grouped
by /64), so no web server module like mod_evasive is needed; that one counts
connections, which says little with HTTP/2.  It takes the client address
from the last entry of the `X-Forwarded-For` header that mod_proxy adds, so
make sure mod_extforward doesn't trust arbitrary clients.

`check-invoice.py` waits up to a minute until the invoice is settled.  If too
many requests already wait (in total, from the same IP, or for the same
invoice), it answers immediately with the current status instead.  The
javascript part takes care to recheck after two seconds and display the paid
message if invoice is settled.

The file `index.html` in this directory contains the client side logic in
javascript.  I use XMLHttpRequest with `POST` as method, mainly to avoid that
intermediate components cache the result.  The result is sent as JSON, so
JSON.parse can be used to parse it.

The file `qrcodegen.min.js` that generates QR-codes is from 
[Project Nayuki][2].  It is under the MIT license.

[1]: https://github.com/lightningnetwork/lnd/blob/master/docs/grpc/python.md
[2]: https://www.nayuki.io/page/qr-code-generator-library
