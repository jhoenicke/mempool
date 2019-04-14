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

var charts;
var config = [
    {"name":"BTC",
     "title":"Bitcoin Core.  Huge mempool limit and no timeout, to prevent any transactions to be dropped.",
     "url":"https://dedi.jochen-hoenicke.de/queue/",
     "symbol":"BTC",
     "satPerUnit": 100000000.0,
     "feelevel": 1,
     "ranges": [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 17, 20, 25, 30, 40, 50, 60, 70, 80, 100, 120, 140, 170, 200, 250, 300, 400, 500, 600, 700, 800, 1000, 1200, 1400, 1700, 2000, 2500, 3000, 4000, 5000, 6000, 7000, 8000, 10000 ],
     "show":   [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37 ],
     "colors": [
   "#535154", "#0000ac", "#0000c2", "#0000d8", "#0000ec", "#0000ff", "#2c2cff", "#5858ff", "#8080ff",
   "#008000", "#00a000", "#00c000", "#00e000", "#30e030", "#60e060", "#90e090",
   "#808000", "#989800", "#b0b000", "#c8c800", "#e0e000", "#e0e030", "#e0e060",
   "#800000", "#a00000", "#c00000", "#e00000", "#e02020", "#e04040", "#e06060",
   "#800080", "#ac00ac", "#d800d8", "#ff00ff", "#ff2cff", "#ff58ff", "#ff80ff",
   "#000000"
             ],
     "inc": true},
    {"name":"BTC (default mempool)",
     "title":"Bitcoin Core with default mempool settings (300 MB + 14 days timeout).",
     "url":"https://core.jochen-hoenicke.de/queue/",
     "symbol":"BTC",
     "satPerUnit": 100000000.0,
     "feelevel": 0,
     "ranges": [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 17, 20, 25, 30, 40, 50, 60, 70, 80, 100, 120, 140, 170, 200, 250, 300, 400, 500, 600, 700, 800, 1000, 1200, 1400, 1700, 2000, 2500, 3000, 4000, 5000, 6000, 7000, 8000, 10000 ],
     "show":   [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37 ],
     "colors": [
   "#535154", "#0000ac", "#0000c2", "#0000d8", "#0000ec", "#0000ff", "#2c2cff", "#5858ff", "#8080ff",
   "#008000", "#00a000", "#00c000", "#00e000", "#30e030", "#60e060", "#90e090",
   "#808000", "#989800", "#b0b000", "#c8c800", "#e0e000", "#e0e030", "#e0e060",
   "#800000", "#a00000", "#c00000", "#e00000", "#e02020", "#e04040", "#e06060",
   "#800080", "#ac00ac", "#d800d8", "#ff00ff", "#ff2cff", "#ff58ff", "#ff80ff",
   "#000000"
             ],
     "inc": true},
    {"name":"BCH",
     "title":"Bitcoin Cash - This node runs ABC 0.18.3.",
     "url":"https://dedi.jochen-hoenicke.de/queue/cash/",
     "symbol":"BCH",
     "satPerUnit": 100000000.0,
     "feelevel": 1,
     "ranges": [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 17, 20, 25, 30, 40, 50, 60, 70, 80, 100, 120, 140, 170, 200, 250, 300, 400, 500, 600, 700, 800, 1000, 1200, 1400, 1700, 2000, 2500, 3000, 4000, 5000, 6000, 7000, 8000, 10000 ],
     "show":   [ 0, 1, 2, 3, 4, 5, 6, 7, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,22,23,24, 25, 26, 27, 28, 29 ],
     "colors": [ "#535154", "#001080", "#349dac", "#a21010", "#7e5e82", "#84b200", "#a0d0cd",
               "#c7b52e", "#6cbbea", "#514f4c", "#4e7fbb", "#9f63a0",
               "#f69445", "#349dac", "#c7b52e", "#514f4c", "#c14540",
               "#7e2e82", "#54b200", "#1e7fbb", "#f67405", "#60e0cd",
               "#e12000", "#123456", "#fe3dba", "#349d00", "#bd00ed",
               "#001080"],
     "inc": true},
    {"name":"BSV",
     "title":"Bitcoin SV 0.1.0.",
     "url":"https://sv.jochen-hoenicke.de/queuesv/",
     "symbol":"BCH",
     "satPerUnit": 100000000.0,
     "feelevel": 1,
     "ranges": [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 17, 20, 25, 30, 40, 50, 60, 70, 80, 100, 120, 140, 170, 200, 250, 300, 400, 500, 600, 700, 800, 1000, 1200, 1400, 1700, 2000, 2500, 3000, 4000, 5000, 6000, 7000, 8000, 10000 ],
     "show":   [ 0, 1, 2, 3, 4, 5, 6, 7, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,22,23,24, 25, 26, 27, 28, 29 ],
     "colors": [ "#535154", "#001080", "#349dac", "#a21010", "#7e5e82", "#84b200", "#a0d0cd",
               "#c7b52e", "#6cbbea", "#514f4c", "#4e7fbb", "#9f63a0",
               "#f69445", "#349dac", "#c7b52e", "#514f4c", "#c14540",
               "#7e2e82", "#54b200", "#1e7fbb", "#f67405", "#60e0cd",
               "#e12000", "#123456", "#fe3dba", "#349d00", "#bd00ed",
               "#001080"],
     "inc": true},
    {"name":"LTC",
     "title":"Litecoin Core with higher memory limit.",
     "url":"https://dedi.jochen-hoenicke.de/queue/litecoin/",
     "symbol":"LTC",
     "satPerUnit": 100000000.0,
     "feelevel": 0,
     "ranges": [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 17, 20, 25, 30,40, 50, 60, 70, 80,100, 120, 140, 170, 200, 250, 300, 400, 500, 600, 700, 800, 1000, 1200, 1400, 2000, 3000, 5000, 7000, 10000 ],
     "show":   [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 13, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40 ],
     "colors": [
   "#535154", "#400080", "#5600ac", "#6100c2", "#6c00d8", "#7600ec", "#7f00ff", "#9020ff",
   "#c040ff", "#0000ac", "#0000c2", "#0000d8", "#0000ec", "#0000ff", "#2c2cff", "#5858ff", "#8080ff",
   "#008000", "#00a000", "#00c000", "#00e000", "#30e030", "#60e060", "#90e090",
   "#808000", "#989800", "#b0b000", "#c8c800", "#e0e000", "#e0e030", "#e0e060",
   "#800000", "#a00000", "#c00000", "#e00000", "#e02020", //"#e04040", "#e06060",
//   "#800080", "#ac00ac", "#d800d8", "#ff00ff", "#ff2cff", "#ff58ff", "#ff80ff",
   "#000000"
                ],
     "inc": true},
    {"name":"DASH",
     "title":"Dash Core v0.13.1.0 with default memory limit",
     "url":"https://dedi.jochen-hoenicke.de/queue/dash/",
     "symbol":"DASH",
     "satPerUnit": 100000000.0,
     "feelevel": 1,
     "ranges": [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 17, 20, 25, 30, 40, 50, 60, 70, 80, 100, 120, 140, 170, 200, 250, 300, 400, 500, 600, 700, 800, 1000, 1200, 1400, 1700, 2000, 2500, 3000, 4000, 5000, 6000, 7000, 8000, 10000 ],
     "show":   [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37 ],
     "colors": [
   "#535154", "#0000ac", "#0000c2", "#0000d8", "#0000ec", "#0000ff", "#2c2cff", "#5858ff", "#8080ff",
   "#008000", "#00a000", "#00c000", "#00e000", "#30e030", "#60e060", "#90e090",
   "#808000", "#989800", "#b0b000", "#c8c800", "#e0e000", "#e0e030", "#e0e060",
   "#800000", "#a00000", "#c00000", "#e00000", "#e02020", "#e04040", "#e06060",
   "#800080", "#ac00ac", "#d800d8", "#ff00ff", "#ff2cff", "#ff58ff", "#ff80ff",
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

function units(chart) {
    switch (chart) {
    case 0: return "tx";
    case 1: return "MB";
    case 2: return config[currconfig].symbol;
    }
}
function scale(chart) {
    switch (chart) {
    case 0: return 1.0;
    case 1: return 1000000.0;
    case 2: return config[currconfig].satPerUnit;
    }
}
function title(chart) {
    switch (chart) {
    case 0: return "Unconfirmed Transaction Count (Mempool)";
    case 1: return "Mempool Size in MB";
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

function legendClick(idx) {
    feelevel = idx;
    for (var i = 0; i < 3; i++) {
        var data = charts[i].getData();
        data = updateData(data, i);
        charts[i].setData(data);
        charts[i].setupGrid();
        charts[i].draw();
    }
}

function tooltip(dataidx, event, pos, item) {
    var plot = charts[dataidx];
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

    for (var i = 0; i < charts.length; i++) {
        var chart = charts[i];
        var opts = chart.getXAxes()[0].options

        opts.min = ranges.xaxis.from;
        opts.max = ranges.xaxis.to;
        chart.setupGrid();
        chart.draw();
        chart.clearSelection();
    }
    var data = charts[0].getData()[0].data;
    var ival = data[1][0] - data[0][0]
    if (ival > 90000) {
        loadRange(opts.min, opts.max, zoomData);
    }
}

function drawTitle(plot, cvs, title) {
    if (!plot) { return; }
    var cvsWidth = plot.width() / 2;

    cvs.font = "bold 16px Open Sans";
    cvs.fillStyle = "#000";
    cvs.textAlign = 'center';
    cvs.fillText(title, cvsWidth, 20);
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

function convertData(raw, dataidx, unit) {
    var show = config[currconfig].show;
    var converted = [];
    var j;
    var theData = storeData(raw, dataidx, unit);
    for (j = 0; j < show.length; j++) {
        var name = config[currconfig].ranges[show[j]];
        var legend =
            j == show.length-1 ? (name+"+ sat/B") :
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

function showChart(raw, dataidx, container, unit) {
    var converted = convertData(raw, dataidx, unit);
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
        selection: { mode: "x" },
        xaxis: { mode: "time", timezone: "browser" },
        legend: { position: "nw", sorted: "reverse",
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
    var plot = $.plot("#"+container, converted, chartconfig);
    plot.hooks.drawOverlay.push( function(plot, cvs) {
        drawTitle(plot, cvs, title(dataidx));
    });
    $(plot.getPlaceholder()).bind("plothover", function (event, pos, item) {
        tooltip(dataidx, event, pos, item);
    });
    $(plot.getPlaceholder()).bind("plotselected", zoomHandler);
    return plot;
}


function showMempool(rawdata) {
    charts = [];
    for (var i = 0; i < 3; i++) {
        charts.push(showChart(rawdata, i, "chartContainer"+(i+1), scale(i)));
    }
    reloadInterval = 300000;
    reloader = update;
    if (reloadInterval > 0) {
        reloading = setTimeout(reloader, reloadInterval);
    }
}

function zoomData(rawdata) {
    storeData(rawdata, 0, 1);
    storeData(rawdata, 1, 1000000.0);
    storeData(rawdata, 2, 100000000.0);
    for (var i = 0; i < 3; i++) {
        charts[i].setData(updateData(charts[i].getData(), i));
    }
    for (var i = 0; i < 3; i++) {
        var chart = charts[i];
        chart.setupGrid();
        chart.draw();
    }
}

var oldconfig;
function loadData(rawdata) {
    if (!charts) {
        feelevel = config[currconfig].feelevel;
        showMempool(rawdata);
        oldconfig = currconfig;
    } else {
        if (currconfig != oldconfig) {
            feelevel = config[currconfig].feelevel;
            for (var i = 0; i < 3; i++) {
                charts[i].setData(convertData(rawdata, i, scale(i)));
            }
            oldconfig = currconfig;
        } else {
            for (var i = 0; i < 3; i++) {
                storeData(rawdata, i, scale(i));
                charts[i].setData(updateData(charts[i].getData(), i));
            }
        }
        for (var i = 0; i < 3; i++) {
            var chart = charts[i];
            var opts = chart.getXAxes()[0].options
            opts.min = null;
            opts.max = null;
            chart.setupGrid();
            chart.draw();
        }
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
    loadRange(charts[0].getAxes().xaxis.max+1000, Date.now()+600000, function(rawdata) {
        for (var i = 0; i < 3; i++) {
            addData(rawdata, i, scale(i));
            charts[i].setData(updateData(charts[i].getData(), i));
            charts[i].setupGrid();
            charts[i].draw();
        }
        reloading = setTimeout(reloader, reloadInterval);
    });
}

function button(timespan) {
    currtimespan = timespan;
    location.hash = "#" + currconfig + "," + timespan;
    loadJSONP(config[currconfig].url + timespan + ".js", loadData);
    selectbutton(timespan);
}

function main() {
    var hashconfig = 0;
    var hashtimespan = "24h";
    if (location.hash.length > 0) {
        var args = location.hash.substring(1).split(",");
        if (args.length == 2) {
            hashconfig = args[0];
            hashtimespan = args[1];
        } else if (args[0].length > 0) {
            hashtimespan = args[0];
        }
    }
    var divconfig = document.getElementById("configs");
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
        divconfig.appendChild(btn);
    }
    var div = document.getElementById("periods");
    var onclickfun = function(e) { button(e.target.text); };
    for (var i = 0; i < periods.length; i++) {
        var name = periods[i];
        var btn = document.createElement("a");
        btn.text = name;
        btn.onclick = onclickfun;
        btn.className = "lnk";
        btn.id = "lk"+name;
        div.appendChild(btn);
    }
    setconfig(hashconfig);
    button(hashtimespan);
}
