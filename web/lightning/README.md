Johoe's lightning setup
=======================

The web/lnd directory contains two python scripts that connect to an instance
of lnd running on the current machine and handle invoices.  They mostly follow 
the lnd grpc tutorial for python.

To use, follow the directions from the [lnd documentation][1] and setup
python in a virtualenv.  I copied the `rpc_pb*` files into the site-packages
directory of the virtual environment.  Use the python from this directory 
in your httpd cgi configuration.  I use lighttpd with:

```
$HTTP["url"] =~ "^/lnd/" {
	cgi.assign = ( ".py" => "/home/lnd/lnd/bin/python" )
}
```

Make sure the `invoice.macaroon` file and `tls.cert` are world readable.  LND 
already sets their permissions correctly, but you have to set executable
permissions for the directories so they are allowed to be traversed.

The script `invoice-mp.py` creates an invoice without any amount (so that
the client will ask for the amount) and with a fixed memo text (that is shown
in the payment history of the client.  If you want to make memo and amount a
parameter you can use `REQUEST_URI` to parse the parameter or better yet, 
use the cgi python package.  But proceed at your own risk and take care to 
sanitize user input.

The script `check-invoice.py` checks for the settlement status of an invoice.
It will repeatedly query the status every second until it is settled or until 
a timeout is reached.  I thought about using the SubscribeInvoices API, but 
you cannot subscribe to a specific invoice and this polling method seemed to 
be simpler in the end.  The javascript part takes care to recheck on timeout 
and display the paid message if invoice is settled.

The file `index.html` in this directory contains the client side logic in
javascript.  I use XMLHttpRequest with `POST` as method, mainly to avoid that
intermediate components cache the result.  The result is sent as JSON, so
JSON.parse can be used to parse it.

The file `qrcode.min.js` that generates QR-codes is from [davidshimjs][2].
It is under the MIT license.

[1]: https://github.com/lightningnetwork/lnd/blob/master/docs/grpc/python.md
[2]: https://github.com/davidshimjs/qrcodejs
