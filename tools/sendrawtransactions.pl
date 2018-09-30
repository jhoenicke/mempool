#!/usr/bin/perl

use JSON::RPC::Legacy::Client;
use Data::Dumper;

my $port = 8332;

if (open COOKIE, "<$ENV{HOME}/.bitcoin/.cookie") {
    $_=<COOKIE>;
    ($user,$pwd) = split ":", $_;
    close COOKIE;
} elsif (open CONFIG, "<$ENV{HOME}/.bitcoin/bitcoin.conf") {
    while (<CONFIG>) {
        /rpcuser=(.*)/ and $user = $1;
        /rpcpassword=(.*)/ and $pwd = $1;
    }
    close CONFIG;
} else {
    print "Cannot find credentials!";
    exit;
}

my $client = new JSON::RPC::Legacy::Client;

$client->ua->credentials("localhost:$port", 'jsonrpc', $user => $pwd);
my $uri = "http://localhost:$port";

while(<>) {
   chomp $_;
   my $res = $client->call($uri, {
      method => 'sendrawtransaction',
      params => [ $_ ],
   });
   if ($res) {
      if ($res->is_error) {
          print "Tx: $_ \n";
          print "Error: ", Dumper($res->error_message);
      }
   } else {
      print $client->status_line;
   }
}
