/*
    Bitcoin Mempool Visualization
    Copyright (C) 2017  Jochen Hoenicke

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as
    published by the Free Software Foundation, either version 3 of the
    License, or (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

var chart;
var bynames = [ "count", "fee", "weight" ];
var byindex = [ 0, 2, 1 ];
var classes = [ "btc", "bch", "ltc", "dash", "doge", "bsv", "eth" ];
var currentby = 0;
var config = [
    {"name":"BTC",
     "classname": "btc",
     "title":"Bitcoin Core 24.0.1.  Huge mempool limit and no timeout, to prevent any transactions to be dropped.",
     "url":"https://johoe.jochen-hoenicke.de/queue/",
     "sizeunit":"vMB",
     "priceunit":"sat/vB",
     "symbol":"BTC",
     "satPerUnit": 100000000.0,
     "feelevel": 1,
     "lastfeelevel": 1,
     "ranges": [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 17, 20, 25, 30, 40, 50, 60, 70, 80, 100, 120, 140, 170, 200, 250, 300, 400, 500, 600, 700, 800, 1000, 1200, 1400, 1700, 2000, 2500, 3000, 4000, 5000, 6000, 7000, 8000, 10000 ],
     "show":   [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30 ],
     "colors": [
   "#535154", "#000060", "#000080", "#0000a0", "#0000c0", "#0000ff", "#2c2cff", "#5858ff", "#8080ff",
   "#008000", "#00a000", "#00c000", "#00e000", "#30e030", "#60e060", "#90e090",
   "#808000", "#989800", "#b0b000", "#c8c800", "#e0e000", "#e0e030", "#e0e060",
   "#800000", "#a00000", "#c00000", "#e00000", "#e02020", "#e04040", "#e06060",
//   "#800080", "#ac00ac", "#d800d8", "#ff00ff", "#ff2cff", "#ff58ff", "#ff80ff",
   "#000000"
             ],
     "inc": true},
    {"name":"BTC (default mempool)",
     "classname": "btc",
     "title":"Bitcoin Core 24.0.1 with default mempool settings (300 MB + 14 days timeout).",
     "url":"https://electrum.jochen-hoenicke.de/btc/",
     "sizeunit":"vMB",
     "priceunit":"sat/vB",
     "symbol":"BTC",
     "satPerUnit": 100000000.0,
     "feelevel": 1,
     "lastfeelevel": 1,
     "ranges": [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 17, 20, 25, 30, 40, 50, 60, 70, 80, 100, 120, 140, 170, 200, 250, 300, 400, 500, 600, 700, 800, 1000, 1200, 1400, 1700, 2000, 2500, 3000, 4000, 5000, 6000, 7000, 8000, 10000 ],
     "show":   [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30 ],
     "colors": [
   "#535154", "#000060", "#000080", "#0000a0", "#0000c0", "#0000ff", "#2c2cff", "#5858ff", "#8080ff",
   "#008000", "#00a000", "#00c000", "#00e000", "#30e030", "#60e060", "#90e090",
   "#808000", "#989800", "#b0b000", "#c8c800", "#e0e000", "#e0e030", "#e0e060",
   "#800000", "#a00000", "#c00000", "#e00000", "#e02020", "#e04040", "#e06060",
//   "#800080", "#ac00ac", "#d800d8", "#ff00ff", "#ff2cff", "#ff58ff", "#ff80ff",
   "#000000"
             ],
     "inc": true},
    {"name":"ETH",
     "classname":"eth",
     "title":"geth 1.10.26 with 150k slots",
     "url":"https://jochen-hoenicke.de/queue/eth/",
     "symbol":"ETH",
     "sizeunit":"Mgas",
     "priceunit":"Gwei",
     "satPerUnit": 1000000000.0,
     "feelevel": 9,
     "lastfeelevel": 9,
     "ranges": [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 17, 20, 25, 30, 40, 50, 60, 70, 80, 100, 120, 140, 170, 200, 250, 300, 400, 500, 600, 700, 800, 1000, 1200, 1400, 1700, 2000, 2500, 3000, 4000, 5000, 6000, 7000, 8000, 10000 ],
     "show":   [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30 ],
     "colors": [
   "#535154", "#000040", "#000070", "#0000a0", "#0000d0", "#0000ff", "#2c2cff", "#5858ff", "#8080ff",
   "#008000", "#00a000", "#00c000", "#00e000", "#30e030", "#60e060", "#90e090",
   "#808000", "#989800", "#b0b000", "#c8c800", "#e0e000", "#e0e030", "#e0e060",
   "#800000", "#a00000", "#c00000", "#e00000", "#e02020", "#e04040", "#e06060",
//   "#800080", "#ac00ac", "#d800d8", "#ff00ff", "#ff2cff", "#ff58ff", "#ff80ff",
   "#000000"
             ],
     "inc": true},
    /*{"name":"ETH-backup",
     "classname":"eth",
     "title":"geth 1.10.26 with 150k slots",
     "url":"https://johoe.jochen-hoenicke.de/queue/ethereum/",
     "symbol":"ETH",
     "sizeunit":"Mgas",
     "priceunit":"Gwei",
     "satPerUnit": 1000000000.0,
     "feelevel": 9,
     "lastfeelevel": 9,
     "ranges": [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 17, 20, 25, 30, 40, 50, 60, 70, 80, 100, 120, 140, 170, 200, 250, 300, 400, 500, 600, 700, 800, 1000, 1200, 1400, 1700, 2000, 2500, 3000, 4000, 5000, 6000, 7000, 8000, 10000 ],
     "show":   [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37],
     "colors": [
   "#535154", "#000040", "#000070", "#0000a0", "#0000d0", "#0000ff", "#2c2cff", "#5858ff", "#8080ff",
   "#008000", "#00a000", "#00c000", "#00e000", "#30e030", "#60e060", "#90e090",
   "#808000", "#989800", "#b0b000", "#c8c800", "#e0e000", "#e0e030", "#e0e060",
   "#800000", "#a00000", "#c00000", "#e00000", "#e02020", "#e04040", "#e06060",
   "#800080", "#ac00ac", "#d800d8", "#ff00ff", "#ff2cff", "#ff58ff", "#ff80ff",
   "#000000"
             ],
     "inc": true},*/
    {"name":"BCH",
     "classname": "bch",
     "title":"Bitcoin Cash - BCHN 26.0.0.",
     "url":"https://johoe.jochen-hoenicke.de/queue/cash/",
     "sizeunit":"MB",
     "priceunit":"sat/B",
     "symbol":"BCH",
     "satPerUnit": 100000000.0,
     "feelevel": 1,
     "lastfeelevel": 1,
     "ranges": [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 17, 20, 25, 30, 40, 50, 60, 70, 80, 100, 120, 140, 170, 200, 250, 300, 400, 500, 600, 700, 800, 1000, 1200, 1400, 1700, 2000, 2500, 3000, 4000, 5000, 6000, 7000, 8000, 10000 ],
     "show":   [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9,  13, 15, 16, 17, 18, 19, 20, 21,22,23,24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35 ],
     "colors": [
   "#535154", "#400080", "#5600ac", "#6100c2", "#6c00d8", "#7600ec", "#7f00ff", "#9020ff",
   "#c040ff", "#0000ac", "#0000c2", "#0000d8", "#0000ec", "#0000ff", "#2c2cff", "#5858ff", "#8080ff",
   "#008000", "#00a000", "#00c000", "#00e000", "#30e030", "#60e060", "#90e090",
   "#808000", "#989800", "#b0b000", "#c8c800", "#e0e000", "#e0e030", "#e0e060",
//   "#800000", "#a00000", "#c00000", "#e00000", "#e02020", //"#e04040", "#e06060",
//   "#800080", "#ac00ac", "#d800d8", "#ff00ff", "#ff2cff", "#ff58ff", "#ff80ff",
   "#000000" ],
     "inc": true},
/*
    {"name":"BSV",
     "classname": "bsv",
     "title":"Bitcoin SV 1.0.8",
     "url":"https://speed.jochen-hoenicke.de/bsv/",
     "sizeunit":"MB",
     "priceunit":"sat/B",
     "symbol":"BSV",
     "satPerUnit": 100000000.0,
     "feelevel": 2,
     "lastfeelevel": 2,
     "ranges": [ 0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 1, 1.2, 1.4, 1.7, 2, 2.5, 3, 4, 5, 6, 7, 8, 10, 12, 14, 17, 20, 25, 30, 40, 50, 60, 70, 80, 100, 120, 140, 170, 200, 250, 300, 400, 500, 600, 700, 800, 1000 ],
     "show":   [ 0, 1, 2, 3, 4, 5, 6, 7, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,22,23,24, 25, 27, 29, 31, 33, 35, 37 ],
     "colors": [
   "#535154", "#808080", "#000080", "#0000a0", "#0000c0", "#0000ff", "#2c2cff", "#5858ff", "#8080ff",
   "#008000", "#00a000", "#00c000", "#00e000", "#30e030", "#60e060", "#90e090",
   "#808000", "#989800", "#b0b000", "#c8c800", "#e0e000", "#e0e030", "#e0e060",
   "#800000", "#a00000", "#c00000", "#e00000", "#e02020", "#e04040", //"#e06060",
   //"#800080", "#ac00ac", "#d800d8", "#ff00ff", "#ff2cff", "#ff58ff", "#ff80ff",
   "#000000"
             ],
      "inc": true},*/
    {"name":"DOGE",
     "classname": "doge",
     "title":"Dogecoin 1.14.5",
     "url":"https://johoe.jochen-hoenicke.de/queue/doge/",
     "symbol":"DOGE",
     "priceunit":"DOGE/kB",
     "sizeunit":"MB",
     "satPerUnit": 100000000.0,
     "feelevel": 0,
     "lastfeelevel": 0,
     "ranges": [ 0, .1, .2, .3, .4, .5, .6, .7, .8, 1, 1.2, 1.4, 1.7, 2, 2.5, 3, 4, 5, 6, 7, 8, 10, 12, 14, 17, 20, 25, 30, 40, 50, 60, 70, 80, 100, 120, 140, 170, 200, 250, 300, 400, 500, 600, 700, 800, 1000 ],
     "show":   [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,22,23,24, 25, 26, 30, 45 ],
     "colors": [
   "#535154", "#400080", "#5600ac", "#6100c2", "#6c00d8", "#7600ec", "#7f00ff", "#9020ff",
   "#c040ff", "#0000ac", "#0000c2", "#0000d8", "#0000ec", "#0000ff", "#2c2cff", "#5858ff", "#8080ff",
   "#008000", "#00a000", "#00c000", "#00e000", "#30e030", "#60e060", "#90e090",
   "#808000", "#989800", "#b0b000", /*"#c8c800", "#e0e000", "#e0e030",*/ "#e0e060",
//   "#800000", "#a00000", "#c00000", "#e00000", "#e02020", "#e04040", "#e06060",
//   "#800080", "#ac00ac", "#d800d8", "#ff00ff", "#ff2cff", "#ff58ff", "#ff80ff",
   "#000000"],
     "inc": true},
    {"name":"LTC",
     "classname": "ltc",
     "title":"Litecoin Core 0.21.1",
     "url":"https://johoe.jochen-hoenicke.de/queue/litecoin/",
     "sizeunit":"vMB",
     "priceunit":"lit/vB",
     "symbol":"LTC",
     "satPerUnit": 100000000.0,
     "feelevel": 1,
     "lastfeelevel": 1,
     "ranges": [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 17, 20, 25, 30,40, 50, 60, 70, 80,100, 120, 140, 170, 200, 250, 300, 400, 500, 600, 700, 800, 1000, 1200, 1400, 2000, 3000, 5000, 7000, 10000 ],
     "show":   [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 13, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32 ],
     "colors": [
   "#535154", "#400080", "#5600ac", "#6100c2", "#6c00d8", "#7600ec", "#7f00ff", "#9020ff",
   "#c040ff", "#0000ac", "#0000c2", "#0000d8", "#0000ec", "#0000ff", "#2c2cff", "#5858ff", "#8080ff",
   "#008000", "#00a000", "#00c000", "#00e000", "#30e030", "#60e060", "#90e090",
   "#808000", "#989800", "#b0b000", "#c8c800",// "#e0e000", "#e0e030", "#e0e060",
//   "#800000", "#a00000", "#c00000", "#e00000", "#e02020", //"#e04040", "#e06060",
//   "#800080", "#ac00ac", "#d800d8", "#ff00ff", "#ff2cff", "#ff58ff", "#ff80ff",
   "#000000"
                ],
     "inc": true}, 
    {"name":"DASH",
     "classname": "dash",
     "title":"Dash Core v18.0.1 with default memory limit",
     "url":"https://johoe.jochen-hoenicke.de/queue/dash/",
     "sizeunit":"MB",
     "priceunit":"Duff/B",
     "symbol":"DASH",
     "satPerUnit": 100000000.0,
     "feelevel": 1,
     "lastfeelevel": 1,
     "ranges": [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 17, 20, 25, 30, 40, 50, 60, 70, 80, 100, 120, 140, 170, 200, 250, 300, 400, 500, 600, 700, 800, 1000, 1200, 1400, 1700, 2000, 2500, 3000, 4000, 5000, 6000, 7000, 8000, 10000 ],
     "show":   [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30 ],
     "colors": [
   "#535154", "#0000ac", "#0000c2", "#0000d8", "#0000ec", "#0000ff", "#2c2cff", "#5858ff", "#8080ff",
   "#008000", "#00a000", "#00c000", "#00e000", "#30e030", "#60e060", "#90e090",
   "#808000", "#989800", "#b0b000", "#c8c800", "#e0e000", "#e0e030", "#e0e060",
   "#800000", "#a00000", "#c00000", "#e00000", "#e02020", "#e04040", "#e06060",
//   "#800080", "#ac00ac", "#d800d8", "#ff00ff", "#ff2cff", "#ff58ff", "#ff80ff",
   "#000000"
             ],
     "inc": true}
];
var periods = ["2h", "8h", "24h", "2d", "4d", "1w", "2w", "30d", "3m", "6m", "1y", "all"];

var reloader;
var reloadInterval = 0;
var reloading;
var precisions = [ 0, 3, 3];
var feelevel = 0;
var data = [];
var currconfig = 0;
var currtimespan;

function units(idx) {
    switch (idx) {
    case 0: return "tx";
    case 1: return config[currconfig].sizeunit;
    case 2: return config[currconfig].symbol;
    }
}
function scale(idx) {
    switch (idx) {
    case 0: return 1.0;
    case 1: return 1000000.0;
    case 2: return config[currconfig].satPerUnit;
    }
}
function title(idx) {
    switch (idx) {
    case 0: return "Unconfirmed Transaction Count (Mempool)";
    case 1: return "Mempool Weight in " + config[currconfig].sizeunit;
    case 2: return "Pending Transaction Fee in " + config[currconfig].symbol;
    }
}

function loadJSONP(url, callback) {
    // Create script
    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = url;

    // Setup handler
    window['call'] = function(data){
        callback(data);
        document.getElementsByTagName('head')[0].removeChild(script);
        script = null;
        delete window['call'];
    };

    // Load JSON
    document.getElementsByTagName('head')[0].appendChild(script);
}

function legendClick(level) {
    feelevel = level;
    config[currconfig].lastfeelevel = level;
    sethash();
    var data = chart.getData();
    data = updateData(data, byindex[currentby]);
    chart.setData(data);
    chart.setupGrid();
    chart.draw();
}

function tooltip(event, pos, item) {
    var dataidx = byindex[currentby];
    var plot = chart;
    var theData = data[dataidx];
    var unit = units(dataidx);
    var prec = precisions[dataidx];
    var series = theData[0];
    var xIndex = 0;
    if (item) {
        xIndex = item.dataIndex;
    } else {
        var y = pos.pageY - plot.offset().top;
        var x = pos.pageX - plot.offset().left;
        if (y >= 0 && y < plot.height() &&
            x >= 0 && x < plot.width()) {
            for (var j = 0; j < series.length; j++) {
                if (series[j][0] <= pos.x || j == 0
                    || series[j][0] - pos.x < pos.x - series[j-1][0]) {
                    xIndex = j;
                }
            }
        }
    }
    if (xIndex) {
        var time = series[xIndex][0];
        var yIndex = feelevel;
        var sum = 0
        for (var i = feelevel; i < config[currconfig].show.length; i++) {
            sum = sum + theData[i][xIndex][1];
            if (sum < pos.y) {
                yIndex = i + 1;
            }
        }
        time = $.plot.formatDate($.plot.dateGenerator(time, {timezone: "browser"}), "%b %d, %H:%M");
        var str = "<strong>"+time+"</strong><br/><table style=\"border-collapse: collapse;\">"
        var sum = 0
        for (var i = config[currconfig].show.length - 1; i >= 0; i--) {
            sum = sum + theData[i][xIndex][1];
            var value = config[currconfig].ranges[config[currconfig].show[i]];
            var rowcolor = "";
            var highlight = "";
            if (i == yIndex) {
                rowcolor = ' style="background-color: ' + config[currconfig].colors[i] + '"';
                highlight = ' class="highlight"';
            }
            str = str + "<tr" + rowcolor + "><td" + highlight + ">" + (value == 0 ? "total" : value + "+") +
                ":&nbsp;</td><td" + highlight + ">" + sum.toFixed(prec).replace(/(\d)(?=(\d{3})+$)/g, '$1,') + "&nbsp;"+unit+"</td></tr>";
        }
        str = str + "</table>";

        var tip = $("#tooltip");
        var totalTipWidth = tip.outerWidth();
        var totalTipHeight = tip.outerHeight();
        var dist=100;
        var x = pos.pageX + dist;
        var y = plot.offset().top;
        if (x - plot.offset().left > plot.width() - totalTipWidth) {
            x -= totalTipWidth + 2*dist;
        }
        tip.html(str)
            .css({top: y, left: x})
            .fadeIn(200);
    } else {
        $("#tooltip").hide();
    }
}

function zoomHandler(event, ranges) {
    clearTimeout(reloading);
    reloading = null;

    // clamp the zooming to prevent eternal zoom
    if (ranges.xaxis.to - ranges.xaxis.from < 60000)
        ranges.xaxis.to = ranges.xaxis.from + 60000

    var opts = chart.getXAxes()[0].options

    opts.min = ranges.xaxis.from;
    opts.max = ranges.xaxis.to;
    chart.setupGrid();
    chart.draw();
    chart.clearSelection();

    var data = chart.getData()[0].data;
    var ival = data[1][0] - data[0][0]
    if (ival > 90000) {
        loadRange(opts.min, opts.max, zoomData);
    }
}

function drawTitle(plot, cvs) {
    if (!plot) { return; }
    var cvsWidth = plot.width() / 2;

    cvs.font = "bold 16px Open Sans";
    cvs.fillStyle = "#000";
    cvs.textAlign = 'center';
    cvs.fillText(title(byindex[currentby]), cvsWidth, 20);
    return cvs;
}

function addData(raw, dataidx, unit) {
    var show = config[currconfig].show;
    for (i = 0; i < raw.length; i++) {
        for (j = 0; j < show.length; j++) {
            function get(array, index) {
                if (index >= array.length) {
                    return 0;
                } else {
                    if (config[currconfig].inc || index == array.length - 1) {
                        return array[index];
                    } else {
                        return array[index] - array[index + 1];
                    }
                }
            }
            var amount = 0;
            for (k = show[j]; k < (j == show.length - 1 ? config[currconfig].ranges.length : show[j + 1]); k++) {
                amount = amount + get(raw[i][dataidx+1],k);
            }
            data[dataidx][j].push([raw[i][0]*1000, amount/unit]);
        }
    }
    return data[dataidx];
}

function storeData(raw, dataidx, unit) {
    data[dataidx] = [];
    for (j = 0; j <= config[currconfig].show.length; j++) {
        data[dataidx][j] = [];
    }
    return addData(raw, dataidx, unit);
}

function updateData(plotdata, dataidx) {
    var theData = data[dataidx];
    var j;
    for (j = 0; j < config[currconfig].show.length; j++) {
        plotdata[j].data = j >= feelevel ? theData[j] :
            [ [ theData[j][0][0], 0 ],
              [theData[j][theData[j].length-1][0], 0]];
        plotdata[j].lines.show = j >= feelevel;
        plotdata[j].stack = j >= feelevel ? 1 : false;
    }
    return plotdata;
}

function convertData(data, dataidx, unit) {
    var show = config[currconfig].show;
    var priceunit = config[currconfig].priceunit;
    var converted = [];
    var j;
    var theData = data[dataidx];
    for (j = 0; j < show.length; j++) {
        var name = config[currconfig].ranges[show[j]];
        var legend =
            j == show.length-1 ? (name+"+ "+priceunit) :
            name+"-"+config[currconfig].ranges[show[j+1]];
        var color = config[currconfig].colors[j];
        converted.push({
            color: color,
            label: legend,
            idx: j,
            stack: j >= feelevel ? 1 : false,
            lines: {
                show: j >= feelevel,
            },
            data: j >= feelevel ? theData[j] :
                [ [ theData[j][0][0], 0 ],
                 [theData[j][theData[j].length-1][0], 0]]
        });
    }
    return converted;
}

function setupChart() {
    var dataidx = byindex[currentby];
    var converted = convertData(data, dataidx, scale(dataidx));
    var legendDiv = document.getElementById("chartLegend");
    var legendColumns = Math.max(1,Math.floor((legendDiv.clientWidth - 70) / 81));
    var chartconfig = {
        series: {
            stack: 1,
            shadowSize: 0,
            lines: {
                show: true,
                fill: 0.66,
                steps: false
            },
        },
        watermark: { mode: "text", order: "background", position: "ne", text: "mempool.jhoenicke.de", font: "30px Arial" },
        selection: { mode: "x" },
        xaxis: { mode: "time", timezone: "browser" },
        legend: { container: legendDiv, sorted: "reverse", noColumns: legendColumns,
                  labelFormatter: function(label, series) {
                      return '<a href="#"'+
                          (series.lines.show ? '': ' class="hide"') +
                          ' onClick="legendClick('+series.idx+
                          '); return false;">'+label+'</a>';
                  }
                },
        grid: { hoverable: true,
                margin: {top:30} },
    };
    chart = $.plot("#chartContainer", converted, chartconfig);
    chart.hooks.drawOverlay.push( function(plot, cvs) {
        drawTitle(plot, cvs);
    });
}

function showChart(raw, dataidx, container, unit) {
    for (var i = 0; i < 3; i++) {
	storeData(raw, i, scale(i));
    }
    setupChart();
    window.onresize = setupChart;
    $(chart.getPlaceholder()).bind("plothover", function (event, pos, item) {
        tooltip(event, pos, item);
    });
    $(chart.getPlaceholder()).bind("plotselected", zoomHandler);
}


function showMempool(rawdata) {
    var idx = byindex[currentby];
    showChart(rawdata, idx, "chartContainer", scale(idx));
    reloadInterval = 300000;
    reloader = update;
    if (reloadInterval > 0) {
        reloading = setTimeout(reloader, reloadInterval);
    }
}

function zoomData(rawdata) {
    for (var i = 0; i < 3; i++) {
	storeData(rawdata, i, scale(i));
    }
    chart.setData(updateData(chart.getData(), byindex[currentby]));
    chart.setupGrid();
    chart.draw();
}

var oldconfig;
function loadData(rawdata) {
    if (!chart) {
        showMempool(rawdata);
        oldconfig = currconfig;
    } else {
	var idx = byindex[currentby];
	for (var i = 0; i < 3; i++) {
	    storeData(rawdata, i, scale(i));
	}
        if (currconfig != oldconfig) {
            chart.setData(convertData(data, idx, scale(idx)));
            oldconfig = currconfig;
        } else {
            chart.setData(updateData(chart.getData(), idx));
        }
        var opts = chart.getXAxes()[0].options
        opts.min = null;
        opts.max = null;
        chart.setupGrid();
        chart.draw();
        if (reloading) {
            clearTimeout(reloading);
        }
        if (reloadInterval > 0) {
            reloading = setTimeout(reloader, reloadInterval);
        }
    }
}

function setconfig(cfg) {
    for (i = 0; i < config.length; i++) {
        if (i == cfg) {
            document.getElementById("cfg"+i).classList.add("selected");
        } else {
            document.getElementById("cfg"+i).classList.remove("selected");
        }
    }
    currconfig = cfg;
    for (i = 0; i < classes.length; i++) {
	for (let el of document.getElementsByClassName(classes[i])) {
	    el.style.display = 'none';
	}
    }
    for (let el of document.getElementsByClassName(config[currconfig].classname)) {
	el.style.display = 'inline';
    }
    feelevel = config[currconfig].lastfeelevel;
}

function selectbutton(timespan) {
    for (i = 0; i < periods.length; i++) {
        if (periods[i] == timespan) {
            document.getElementById("lk"+periods[i]).classList.add("selected");
        } else {
            document.getElementById("lk"+periods[i]).classList.remove("selected");
        }
    }
}

function loadRange(from, to, func) {
    var increment = Math.floor((to - from) / 60000000);
    if (increment < 1) {
        increment = 1;
    }
    loadJSONP(config[currconfig].url +
              "db.php?s=" + Math.floor(from/1000) +
              "&e=" + Math.floor(to/1000) +
              "&i=" + increment, func);
}

function update() {
    loadRange(chart.getAxes().xaxis.max+1000, Date.now()+600000, function(rawdata) {
	var idx = byindex[currentby];
	addData(rawdata, idx, scale(idx));
        chart.setData(updateData(chart.getData(), idx));
        chart.setupGrid();
        chart.draw();
        reloading = setTimeout(reloader, reloadInterval);
    });
}

function sethash() {
    var optfeelevel = "";
    if (feelevel != config[currconfig].feelevel) {
	optfeelevel = "," +
	    config[currconfig].ranges[config[currconfig].show[feelevel]];
    }
    location.hash = "#" + config[currconfig].name + "," + currtimespan + "," + bynames[currentby] + optfeelevel;
}

function button(timespan) {
    currtimespan = timespan;
    sethash();
    loadJSONP(config[currconfig].url + timespan + ".js", loadData);
    selectbutton(timespan);
}

function copyToClip(fldname) {
    var fld = document.getElementById(fldname);
    fld.select();
    fld.setSelectionRange(0,9999);
    document.execCommand("copy");
}

function findcoin(name) {
    var confignr;
    if (/^\d+$/.test(name)) {
	confignr = name;
    } else {
	name = decodeURIComponent(name);
	confignr = config.findIndex((item) => item.name == name);
    }
    if (confignr < 0 || confignr > config.length) {
	return 0;
    }
    return confignr
}

function clickby(pos) {
    for (i = 0; i < bynames.length; i++) {
        if (i == pos) {
            document.getElementById("by"+i).classList.add("selected");
        } else {
            document.getElementById("by"+i).classList.remove("selected");
        }
    }
    currentby = pos;
    if (chart) {
	chart.setData(updateData(chart.getData(), byindex[currentby]));
	chart.setupGrid();
	chart.draw();
    }
    sethash();
}

var resizeOffset;

function resizeChart(e) {
    var newHeight = e.clientY + resizeOffset;
    if (newHeight > 100 && newHeight < 10000) {
        document.getElementById("chartContainer").style.height = newHeight + "px";
    }
    return false;
}

function resizeChartTouch(e) {
    var newHeight = e.touches.item(0).clientY + resizeOffset;
    if (newHeight > 100 && newHeight < 10000) {
        document.getElementById("chartContainer").style.height = newHeight + "px";
    }
    return false;
}

function stopResize(e) {
    document.removeEventListener('mousemove', resizeChart);
    document.removeEventListener('mouseup', stopResize);
    return false;
}

function dragDivider(e) {
    resizeOffset = document.getElementById("chartContainer").clientHeight - e.clientY;
    document.addEventListener('mousemove', resizeChart);
    document.addEventListener('mouseup', stopResize);
    return false;
}

function stopTouch(e) {
    document.removeEventListener('touchmove', resizeChartTouch);
    document.removeEventListener('touchend', stopTouch);
    return false;
}

function touchDivider(e) {
    resizeOffset = document.getElementById("chartContainer").clientHeight - e.touches.item(0).clientY;
    document.addEventListener('touchmove', resizeChartTouch);
    document.addEventListener('touchend', stopTouch);
    return false;
}

function main() {
    var hashconfig = 0;
    var hashtimespan = "24h";
    var hashfeelevel = -1;
    var hashby = 2;
    if (location.hash.length > 0) {
        var args = location.hash.substring(1).split(",");
	var argindex = 0;
	if (argindex + 1 < args.length) {
	    hashconfig = findcoin(args[argindex]);
	    argindex++;
	}
	if (argindex < args.length) {
	    hashtimespan = args[argindex];
	    argindex++;
	}
	if (argindex < args.length) {
	    hashby = bynames.findIndex((item) => item == args[argindex]);
	    if (hashby >= 0 && hashby < bynames.length) {
		argindex++;
	    } else {
		hashby = 2;
	    }
	}
	if (argindex < args.length) {
	    hashfeelevel = args[argindex];
	    argindex++;
	}
    }
    var div = document.getElementById("configs");
    for (var i = 0; i < config.length; i++) {
        var name = config[i].name;
        var title = config[i].title;
        var btn = document.createElement("a");
        btn.text = name;
        if (title) {
            btn.title = title;
        }
        (function() {
            var cfg = i;
            btn.onclick = function(e) { setconfig(cfg); button(currtimespan); }
        })();
        btn.className = "lnk";
        btn.id = "cfg"+i;
        div.appendChild(document.createTextNode("\u200b"));
        div.appendChild(btn);
    }
    div = document.getElementById("periods");
    var onclickfun = function(e) { button(e.target.text); };
    for (var i = 0; i < periods.length; i++) {
        var name = periods[i];
        var btn = document.createElement("a");
        btn.text = name;
        btn.onclick = onclickfun;
        btn.className = "lnk";
        btn.id = "lk"+name;
        div.appendChild(document.createTextNode("\u200b"));
        div.appendChild(btn);
    }
    div = document.getElementById("by");
    for (var i = 0; i < bynames.length; i++) {
        var name = bynames[i];
        var btn = document.createElement("a");
        btn.text = name;
        (function() {
            var cfg = i;
            btn.onclick = function(e) { clickby(cfg); }
        })();
        btn.className = "lnk";
        btn.id = "by"+i;
        div.appendChild(document.createTextNode("\u200b"));
        div.appendChild(btn);
    }
    setconfig(hashconfig);
    if (hashfeelevel >= 0) {
	feelevel = config[currconfig].show.findIndex(show => config[currconfig].ranges[show] >= hashfeelevel);
	if (feelevel < 0) {
	    feelevel = config[currconfig].feelevel;
	}
    }
    currentby = hashby;
    document.getElementById("by"+currentby).classList.add("selected");
    button(hashtimespan);
    document.getElementById("chartDivider").onmousedown = dragDivider;
    document.getElementById("chartDivider").ontouchstart = touchDivider;
}
