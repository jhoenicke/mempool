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
sudo -u lnd lncli bakemacaroon --save_to /tmp/lnweb.macaroon \
    uri:/lnrpc.Lightning/AddInvoice uri:/lnrpc.Lightning/LookupInvoice \
    uri:/lnrpc.Lightning/SubscribeInvoices
sudo install -m 640 -g lnweb /tmp/lnweb.macaroon /etc/lnweb/lnweb.macaroon
sudo rm /tmp/lnweb.macaroon
sudo install -m 644 /home/lnd/.lnd/tls.cert /etc/lnweb/tls.cert
sudo install -m 644 lnweb/lnweb.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now lnweb
```

Adjust the paths in `lnweb.service` (python from the virtualenv, the
`.well-known/lnurlp/` file) to your setup.  The `lnweb` user needs read
access to the virtualenv.  The LNURL metadata is read from the
`.well-known/lnurlp/` file, so its description hash always matches what the
wallet got.  When lnd regenerates its certificate, copy `tls.cert` again.

Since nothing else reads them anymore, `invoice.macaroon`, `tls.cert` and the
lnd directories don't need to be world readable or traversable.  Make sure
`admin.macaroon`, `tls.key` and `wallet.db` are only readable by lnd.

Then let the web server forward `/lnd/` to the service.  I use lighttpd with:

```
server.modules += ( "mod_proxy", "mod_evasive" )

$HTTP["url"] =~ "^/lnd/" {
    proxy.server = ( "" => (( "host" => "127.0.0.1", "port" => 8089 )) )
    evasive.max-conns-per-ip = 8
}
```

The service takes the client address for its per-IP limits from the last
entry of the `X-Forwarded-For` header that mod_proxy adds.

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
