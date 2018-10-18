import rpc_pb2 as ln
import rpc_pb2_grpc as lnrpc
import cgi
import grpc
import re
import os
import sys
import codecs
import binascii

def main():
    # Due to updated ECDSA generated tls.cert we need to let gprc know that
    # we need to use that cipher suite otherwise there will be a handshake
    # error when we communicate with the lnd rpc server.
    os.environ["GRPC_SSL_CIPHER_SUITES"] = 'HIGH+ECDSA'

    with open('/home/lnd/.lnd/tls.cert', 'rb') as f:
        cert = f.read()

    with open('/home/lnd/.lnd/data/chain/bitcoin/mainnet/invoice.macaroon', 'rb') as f:
        macaroon_bytes = f.read()
        macaroon = codecs.encode(macaroon_bytes, 'hex')

    def metadata_callback(context, callback):
        # for more info see grpc docs
        callback([('macaroon', macaroon)], None)

    # build ssl credentials using the cert the same as before
    cert_creds = grpc.ssl_channel_credentials(cert)
    # now build meta data credentials
    auth_creds = grpc.metadata_call_credentials(metadata_callback)
    # combine the cert credentials and the macaroon auth credentials
    # such that every call is properly encrypted and authenticated
    combined_creds = grpc.composite_channel_credentials(cert_creds, auth_creds)

    # finally pass in the combined credentials when creating a channel
    channel = grpc.secure_channel('localhost:10009', combined_creds)
    stub = lnrpc.LightningStub(channel)
    form = cgi.FieldStorage()
    value = long(form["value"].value) if "value" in form.keys() else 0
    memo = form["memo"].value if "memo" in form.keys() else ""

    invoice = stub.AddInvoice(ln.Invoice(memo=memo, value=value))
    print("Content-Type: application/json; charset=UTF-8")
    print("")
    print('{"r_hash":"%s","payment_request":"%s","add_index":%d}' % (binascii.hexlify(invoice.r_hash),invoice.payment_request,invoice.add_index))


debug = False
#debug = True
if debug:
    sys.stderr = sys.stdout
try:
    main()
except:
    import traceback
    print("Status: 500 Internal Error")
    print("Content-Type: text/html; charset=UTF-8")
    print("")
    print("<h1>500 Internal Server Error</h1>")
    if debug:
        print("<pre>")
        traceback.print_exc()
        print("</pre>")
    else:
        traceback.print_exc()
