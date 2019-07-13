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

    bitcoin-cli getmempoolinfo

Install `mysql` and create a database. Then you can test your
configuration by running mempool.sh.  If you don't want to use mysql,
comment out the four lines starting with `open(SQL` at the end of
`mempool-sql.pl`.  In that case zooming and auto-update in the
webinterface won't work.

    sudo apt install mysql_server
    mysql_secure_installation
    mysql -u root -p <<EOF
    create database btc_mempool;
    grant all privileges on btc_mempool.* TO 'mempool'@'localhost' identified by '<secret password>';
    grant select on btc_mempool.* TO 'www'@'localhost' identified by '<redacted>';
    EOF
    cat > ~/.my.cnf <<EOF
    [client]
    user=mempool
    password=<secret password>
    EOF
    cd mempool
    perl mempool-create.pl | mysql btc_mempool
    ./mempool.sh

You are almost ready now.  Check that everything works.  There should be a
file `mempool.log` containing one line of statistics.  There should be
newly created files in `/dev/shm/mempool-btc` that contain the dynamic data the
webserver should serve.  If everything looks fine add the following crontab 
entry (using `crontab -e`):

    * * * * * /home/mempool/mempool/mempool.sh 

## Installation: Part 2 - Web service

Install a web server of your choice.  For refreshing/zooming you need
php and php-mysql.  Then link/copy the web subdirectory to the web
root.  Finally link to the dynamic js files in `/dev/shm/mempool-btc`.

    cd $HOME/mempool/web/queue
    sudo ln -s $HOME/mempool/web/* /var/www/html
    ln -s /dev/shm/mempool-btc/*.js $HOME/mempool/web/queue/

You then need to open `$HOME/mempool/web/queue/mempool.js` in your favorite
editor and change the config array to include your web server configuration.
