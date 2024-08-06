#!/usr/bin/python3

import os
import sys
import codecs
import binascii
import hashlib
import grpc
import lightning_pb2 as ln
import lightning_pb2_grpc as lnrpc
from urllib.parse import parse_qs

metadata="[[\"text/plain\",\"Johoe's Mempool\"],[\"text/identifier\",\"mempool@jhoenicke.de\"],[\"image/png;base64\",\"iVBORw0KGgoAAAANSUhEUgAAAfQAAAH0CAMAAAD8CC+4AAAC8VBMVEUAAAD////+/v7///////////////////////////////////8cAAD///////////////////////////////////8mAgD///9RBwFWBwH//v7+/v7///9QBgD///////////////////8tAQA2AQD///////////9bDwlMAgD///9CAQBGBAE/AQAvJQH///8yAgA7AwD///9KBgD///////////////86KAD///8oFwH///////////9DQ0NnOQNJKgVHICBQQRJZLi5TMQBLJAxbLwB6V1SZdm58TU2bcHC1lJSNY00xPAAAAADd3WZm3WbdZmZmZu7///8AAcwAqgCqqgA3N6gFAAAFBQX5+fkWAQAQAAApAAAKCgoQEBDv7+8MAAD19fU1NTVcFxe1SUnS0lDs6+vKyckzCQjY2NgWFhYkAQFtbW1V1VXSXV291lc7OzsiuyLDwsLEU1NDDQ0OsAsLDADW2F4nBgUcHByyshCKiopmZmY+yT63t7dNTU29vLzWcFd1IyNVVejo5+ePj49YvikcAQF/f38pKSni4uKrqqoYFAAjJCXd3d2BKSnKyj/CwjAtLi66uiFrHh4twS0hAQEgICBfX1+MMDB2dnZVVVWVNTW8kiOznhJISEhJSeVbxnEWFtRBQQnS0dGZmZk6Cws+KQOjo6NRUVGmPz8NDdGEhIRaWlpL0Es9PeEhIddREhIiIwDOe0deXutb2FspKdqFyT3CijArtBQYthgzM956enpKDw8CPwEwaJ0jTKkpWKNFuh8NHb+dnZ03eJRswzKMjCscPbCxsUM5OaxTtXlMpIDM112k0EyrpAdfXxAVLreTk5OsQ0OWlpZBQUHIgjxubhE9hY99ehWdOTmzr61Ek4g/Pz9QUAgECSWeniw1NAQCjwIAIwDCwlABbQE1qDKRkQUPmg9HmoWIZFybzEYKEEFAjIsjI4SkgYFrQz1JScYWFmZ2TEwAAKBCjosyMp8uLplDkokWP3JmFJT1AAAATnRSTlMAgP34BvRtDLoTJFX2ie92GUZMmZDK62U1HV460UuyxEDqLt7IHt40D2DamYWq/SnUuoR31azi5u7k/qSooP5i1vz++L2smv7306+njOnCxU1gAABF1UlEQVR42uzc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\"]]"

def connect():
    # Due to updated ECDSA generated tls.cert we need to let gprc know that
    # we need to use that cipher suite otherwise there will be a handshake
    # error when we communicate with the lnd rpc server.
    os.environ["GRPC_SSL_CIPHER_SUITES"] = 'HIGH+ECDSA'

    with open('/home/lnd/.lnd/tls.cert', 'rb') as f:
        cert = f.read()

    with open('/home/lnd/.lnd/data/chain/bitcoin/mainnet/invoice.macaroon', 'rb') as f:
        macaroon_bytes = f.read()
        macaroon = codecs.encode(macaroon_bytes, 'hex')

    def metadata_callback(_context, callback):
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
    return stub

def main():
    stub = connect()
    form = parse_qs(os.environ['QUERY_STRING'])
    value = int(form["amount"][0]) if "amount" in form.keys() else 0
    memo = (" - " + form["comment"][0]) if "comment" in form.keys() else ""
    memo = f"Johoe's Mempool{memo}"
    descr_hash = hashlib.sha256(metadata.encode('utf-8')).digest()

    invoice = stub.AddInvoice(ln.Invoice(memo=memo, value_msat=value, description_hash=descr_hash))
    print("Content-Type: application/json; charset=UTF-8")
    print("")
    print(f'{{"pr":"{invoice.payment_request}","routes":[]}}')

debug = False
#debug = True
if debug:
    sys.stderr = sys.stdout
try:
    main()
except Exception:
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
