# Bitcoin Mempool Statistics

This is the code to create the mempool statistics for bitcoin that are online
at https://jochen-hoenicke.de/queue/

## Installation: Part 1 - Logging

You need to be running a bitcoin full node.  It can be a pruned node or an
archival node.  I assume you have already set it up.  You also need to
support RPC to this node.  Add rpcuser/rpcpassword to bitcoin.conf to enable
this.

I recommend to create a new user `mempool`.   Checkout this repository into
his home directory:

    sudo -H -u mempool bash
    cd $HOME
    git clone https://github.com/jhoenicke/mempool

Edit `mempool.sh` to adapt paths as necessary, especially the path to 
bitcoin-cli.  Add a bitcoin.conf with rpcuser/rpcpassword settings to 
`/home/mempool/.bitcoin`, to be able to use bitcoin-cli.  You can test your
setup by running

    bitcoin-cli getinfo

Install `sqlite3` and create a new empty database. Then you can test your
configuration by running mempool.sh

    sudo apt install sqlite3
    cd mempool
    sqlite3 mempool.s3db < mempool-create.sql
    ./mempool.sh

You are almost ready now.  Check that everything works.  There should be a
file `mempool.log` containing one line of statistics.  There should be
newly created files in `/dev/shm/mempool` that contain the dynamic date the
webserver should serve.  If everything looks fine add the following crontab 
entry (using `crontab -e`):

    * * * * * /home/mempool/mempool/mempool.sh 

## Installation: Part 2 - Web service

Install a web server of your choice.  For refreshing/zooming you need
php and php-sqlite.  Then link/copy the web subdirectory to the web
root.  Finally link to the dynamic js files in `/dev/shm/mempool`.

    cd $HOME/mempool/web/queue
    sudo ln -s $HOME/mempool/web/* /var/www/html
    ln -s /dev/shm/mempool/*.js $HOME/mempool/web/queue/
