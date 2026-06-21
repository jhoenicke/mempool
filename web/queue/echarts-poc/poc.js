/*
    Bitcoin Mempool Visualization - ECharts Proof of Concept
    Copyright (C) 2017-2026  Jochen Hoenicke

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

    ----------------------------------------------------------------------
    This is a PROOF OF CONCEPT that re-implements the Flot-based chart on
    top of Apache ECharts.  It reuses the exact data model and transforms
    of the original mempool.js so it renders the live production feed.
    It demonstrates the parts that needed evaluating before committing to
    ECharts: stacked area, mobile touch zoom (dataZoom), a custom tooltip
    with cumulative per-band sums, the "feelevel" legend interaction
    (click a band -> hide everything below it), and zoom-to-reload of
    higher-resolution data via db.php.
*/

var chart;                       // the ECharts instance
var bynames = [ "count", "fee", "weight" ];
var byindex = [ 0, 2, 1 ];
var currentby = 0;
var config = [
    {"name":"BTC",
     "classname": "btc",
     "title":"Bitcoin Core 30.2.  Huge mempool limit and no timeout.",
     "url":"https://johoe.jochen-hoenicke.de/queue/2/",
     "sizeunit":"vMB",
     "priceunit":"sat/vB",
     "symbol":"BTC",
     "satPerUnit": 100000000.0,
     "feelevel": 1,
     "lastfeelevel": 1,
     "ranges": [ 0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 1, 1.2, 1.4, 1.7, 2, 2.5, 3, 4, 5, 6, 7, 8, 10, 12, 14, 17, 20, 25, 30, 40, 50, 60, 70, 80, 100, 120, 140, 170, 200, 250, 300, 400, 500, 600, 700, 800, 1000, 1200, 1400, 1700, 2000, 2500, 3000, 4000, 5000, 6000, 7000, 8000, 10000 ],
     "show":   [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31,32,33,34,35,36,37, 38,39, 40,41 ],
     "colors": [
   "#535154",
   "#000040", "#000080", "#0000c0", "#0000ff",
   "#004000", "#006000", "#008000", "#00a000", "#00c000", "#00e000", "#00f000", "#20e020", "#40e040", "#60e060", "#80e080", "#a0e0a0",
   "#404000", "#606000", "#808000", "#a0a000", "#c0c000", "#e0e000", "#f0f000", "#e0e020", "#e0e040", "#e0e060", "#e0e080", "#e0e0a0",
   "#400000", "#600000", "#800000", "#a00000", "#c00000", "#e00000", "#f00000", "#e02020", "#e04040", "#e06060", "#e08080", "#e0a0a0",
   "#000000"
             ],
     "inc": true},
    {"name":"ETH",
     "classname":"eth",
     "title":"geth 1.17.1 + nimbus 26.3.0 with 150k slots",
     "url":"https://jochen-hoenicke.de/queue/eth4/",
     "symbol":"ETH",
     "sizeunit":"Mgas",
     "priceunit":"Gwei",
     "satPerUnit": 1000000000.0,
     "feelevel": 5,
     "lastfeelevel": 5,
     "ranges": [ 0, .001, .002, .003, .004, .005, .006, .007, .008, .01, .012, .014, .017, .02, .025, .03, .04, .05, .06, .07, .08, 0.1, .12, .14, .17, 0.2, .25, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 1, 1.2, 1.4, 1.7, 2, 2.5, 3, 4, 5, 6, 7, 8, 10, 12, 14, 17, 20, 25, 30, 40, 50, 60, 70, 80, 100, 120, 140, 170, 200, 250, 300, 400, 500, 600, 700, 800, 1000 ],
     "show":   [ 0, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65],
     "colors": [
   "#535154", "#400080", "#5600ac", "#6100c2", "#6c00d8", "#7600ec", "#7f00ff", "#9020ff",
   "#c040ff",
   "#000040", "#000050", "#000060", "#000065", "#000070", "#000088", "#0000a0", "#0000d0", "#0000ff", "#2c2cff", "#5858ff", "#8080ff",
   "#004000", "#006000", "#008000", "#00a000", "#00c000", "#00e000", "#00f000", "#20e020", "#40e040", "#60e060", "#80e080", "#a0e0a0",
   "#404000", "#606000", "#808000", "#a0a000", "#c0c000", "#e0e000", "#f0f000", "#e0e020", "#e0e040", "#e0e060", "#e0e080", "#e0e0a0",
   "#400000", "#600000", "#800000", "#a00000", "#c00000", "#e00000", "#f00000", "#e02020", "#e04040", "#e06060", "#e08080", "#e0a0a0",
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
var data = [];                   // data[dataidx][bandidx] = [ [t, value], ... ]
var currconfig = 0;
var currtimespan = "24h";
var zoomWindow = null;           // {from,to} in ms while the user is zoomed in; null = full view
var programmaticZoom = false;    // guard so our own zoom updates don't re-trigger the handler
var baseFrom, baseTo;            // full extent of the selected period; zoom never loads beyond this

/* ----- units / scale / title, identical semantics to the original ----- */
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

/* ----- JSONP loader, unchanged from the original ----- */
function loadJSONP(url, callback) {
    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = url;
    window['call'] = function(data){
        callback(data);
        document.getElementsByTagName('head')[0].removeChild(script);
        script = null;
        delete window['call'];
    };
    document.getElementsByTagName('head')[0].appendChild(script);
}

/* ----- data transforms, ported verbatim from mempool.js ----- */
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

/* ----- ECharts series construction ----- */
// Build one ECharts area series per visible fee band.  Bands below the
// chosen feelevel are stacked but rendered empty, mirroring the original
// updateData()/convertData() behaviour.
function buildSeries() {
    var dataidx = byindex[currentby];
    var theData = data[dataidx];
    var show = config[currconfig].show;
    var priceunit = config[currconfig].priceunit;
    var series = [];
    for (var j = 0; j < show.length; j++) {
        var name = config[currconfig].ranges[show[j]];
        var legend = j == show.length - 1 ? (name + "+ " + priceunit)
                                           : name + "-" + config[currconfig].ranges[show[j+1]];
        var visible = j >= feelevel;
        var color = config[currconfig].colors[j];
        series.push({
            id: "band" + j,
            name: legend,
            type: "line",
            stack: "total",
            stackStrategy: "all",
            showSymbol: false,
            lineStyle: { width: visible ? 0.5 : 0, color: color },
            areaStyle: visible ? { color: color, opacity: 0.66 } : { opacity: 0 },
            emphasis: { disabled: true },
            // bands below feelevel contribute 0 to the stack
            data: visible ? theData[j] : theData[j].map(function(p){ return [p[0], 0]; })
        });
    }
    return series;
}

// The cumulative-sum tooltip: for the hovered time, show every band from
// the top down with the running total, like the original Flot tooltip.
function tooltipFormatter(params) {
    if (!params.length) { return ""; }
    var dataidx = byindex[currentby];
    var prec = precisions[dataidx];
    var unit = units(dataidx);
    var show = config[currconfig].show;
    var xIndex = params[0].dataIndex;
    var theData = data[dataidx];
    var time = echarts.format.formatTime("MMM dd, hh:mm", theData[0][xIndex][0]);
    var str = "<strong>" + time + "</strong><table style='border-collapse:collapse'>";
    var sum = 0;
    for (var i = show.length - 1; i >= 0; i--) {
        if (i < feelevel) { continue; }
        sum += theData[i][xIndex][1];
        var value = config[currconfig].ranges[show[i]];
        var sw = "<span style='display:inline-block;width:9px;height:9px;margin-right:4px;background:" +
                 config[currconfig].colors[i] + "'></span>";
        str += "<tr><td>" + sw + (value == 0 ? "total" : value + "+") + ":&nbsp;</td><td style='text-align:right'>" +
               sum.toFixed(prec).replace(/(\d)(?=(\d{3})+$)/g, '$1,') + "&nbsp;" + unit + "</td></tr>";
    }
    return str + "</table>";
}

function baseOption() {
    return {
        animation: false,
        title: {
            text: title(byindex[currentby]),
            left: "center",
            textStyle: { fontSize: 16, fontWeight: "bold", fontFamily: "Open Sans, sans-serif" }
        },
        tooltip: {
            trigger: "axis",
            confine: true,
            axisPointer: { type: "line" },
            formatter: tooltipFormatter,
            textStyle: { fontSize: 12 }
        },
        grid: { left: 60, right: 20, top: 40, bottom: 70 },
        xAxis: {
            type: "time",
            axisLabel: { hideOverlap: true }
        },
        yAxis: {
            type: "value",
            name: units(byindex[currentby]),
            scale: false
        },
        // dataZoom gives us pinch/drag zoom on mobile and a slider on desktop.
        dataZoom: [
            { type: "inside", filterMode: "none" },
            { type: "slider", filterMode: "none", height: 22, bottom: 18 }
        ],
        graphic: [{
            type: "text", right: 12, top: 28, z: 0,
            style: { text: "mempool.jhoenicke.de", fontSize: 20, fill: "rgba(0,0,0,0.12)", fontFamily: "Arial" }
        }],
        series: buildSeries()
    };
}

/* ----- chart lifecycle ----- */
function setupChart() {
    if (!chart) {
        chart = echarts.init(document.getElementById("chartContainer"), null, { renderer: "canvas" });
        chart.on("datazoom", onDataZoom);
    }
    chart.setOption(baseOption(), { notMerge: true });
}

// Re-render only the series + title + y-axis (used when toggling by/feelevel
// without reloading data).
function refreshChart() {
    chart.setOption({
        title: { text: title(byindex[currentby]) },
        yAxis: { name: units(byindex[currentby]) },
        series: buildSeries()
    });
}

function loadData(rawdata) {
    for (var i = 0; i < 3; i++) {
        storeData(rawdata, i, scale(i));
    }
    // Remember the full period extent: zooming never loads outside it (use the
    // period buttons for a wider range), so we never churn-reload at its edges.
    var s0 = data[byindex[currentby]][0];
    baseFrom = s0[0][0];
    baseTo = s0[s0.length - 1][0];
    setupChart();
    if (reloading) { clearTimeout(reloading); }
    reloadInterval = 300000;
    reloader = update;
    reloading = setTimeout(reloader, reloadInterval);
}

function update() {
    var theData = data[byindex[currentby]];
    var lastT = theData[0][theData[0].length - 1][0];
    loadRange(lastT + 1000, Date.now() + 600000, function(rawdata) {
        for (var i = 0; i < 3; i++) {
            addData(rawdata, i, scale(i));
        }
        refreshChart();
        // keep the user's absolute window after appending fresh data
        if (zoomWindow) { pinZoom(zoomWindow.from, zoomWindow.to); }
        reloading = setTimeout(reloader, reloadInterval);
    });
}

/* ----- zoom -> reload higher resolution, like the original zoomHandler ----- */
function loadRange(from, to, func) {
    var increment = Math.floor((to - from) / 60000000);
    if (increment < 1) { increment = 1; }
    loadJSONP(config[currconfig].url +
              "db.php?s=" + Math.floor(from/1000) +
              "&e=" + Math.floor(to/1000) +
              "&i=" + increment, func);
}

// The currently visible [from,to] window in absolute ms.
function getWindow() {
    var axis = chart.getModel().getComponent("xAxis").axis;
    var extent = axis.scale.getExtent();   // [minMs, maxMs] currently shown
    return { from: extent[0], to: extent[1] };
}

// Pin the view to an absolute time window (NOT a percentage), so it survives
// a data reload that changes the underlying time span.
function pinZoom(from, to) {
    programmaticZoom = true;
    chart.dispatchAction({ type: "dataZoom", startValue: from, endValue: to });
}

// Choose a sampling increment (in whole minutes, as db.php expects) for a
// given visible window width, aiming for a few hundred points across it.
function incrementFor(spanMs) {
    var inc = Math.floor(spanMs / 60000000);   // same formula as the original loadRange
    return inc < 1 ? 1 : inc;
}

// Reload data for the visible window [visFrom,visTo], expanded by a margin on
// each side (clamped to the period) so there is room to zoom/pan back out,
// then re-anchor the view to the window the user is actually looking at.
function loadViewport(visFrom, visTo) {
    var span = visTo - visFrom;
    var inc = incrementFor(span);
    var margin = span * 0.5;
    var from = Math.max(baseFrom, visFrom - margin);
    var to = Math.min(baseTo, visTo + margin);
    loadJSONP(config[currconfig].url +
              "db.php?s=" + Math.floor(from/1000) +
              "&e=" + Math.floor(to/1000) +
              "&i=" + inc, function(rawdata) {
        for (var i = 0; i < 3; i++) {
            storeData(rawdata, i, scale(i));
        }
        refreshChart();
        pinZoom(visFrom, visTo);   // keep the user's window after swapping data
    });
}

var zoomDebounce;
function onDataZoom() {
    if (programmaticZoom) { programmaticZoom = false; return; }
    clearTimeout(zoomDebounce);
    zoomDebounce = setTimeout(function() {
        var w = getWindow();
        var series0 = data[byindex[currentby]][0];
        if (series0.length < 2) { return; }
        var dataFrom = series0[0][0], dataTo = series0[series0.length - 1][0];
        var span = w.to - w.from;
        // track the absolute window so auto-reload can keep it (null = full period)
        zoomWindow = span < (baseTo - baseFrom) * 0.999 ? w : null;

        var loadedInc = (series0[1][0] - series0[0][0]) / 60000;   // current resolution, minutes
        var idealInc = incrementFor(span);
        // resolution far from ideal -> we zoomed in (need finer) or out (need coarser)
        var resoMismatch = loadedInc > idealInc * 1.8 || loadedInc < idealInc / 1.8;
        // visible edge approaching the loaded data edge, and more data exists in the period
        var nearLeft  = (w.from - dataFrom) < span * 0.15 && dataFrom > baseFrom + 1000;
        var nearRight = (dataTo - w.to)     < span * 0.15 && dataTo   < baseTo   - 1000;

        if (resoMismatch || nearLeft || nearRight) {
            loadViewport(w.from, w.to);
        }
    }, 250);
}

/* ----- feelevel legend (click a band -> hide everything below it) ----- */
function buildLegend() {
    var div = document.getElementById("chartLegend");
    div.innerHTML = "";
    var show = config[currconfig].show;
    var priceunit = config[currconfig].priceunit;
    for (var j = show.length - 1; j >= 0; j--) {
        var name = config[currconfig].ranges[show[j]];
        var label = j == show.length - 1 ? (name + "+ " + priceunit)
                                          : name + "-" + config[currconfig].ranges[show[j+1]];
        var a = document.createElement("a");
        a.className = "legenditem" + (j < feelevel ? " hide" : "");
        a.innerHTML = "<span class='swatch' style='background:" + config[currconfig].colors[j] +
                      "'></span>" + label;
        (function(level){
            a.onclick = function() { legendClick(level); return false; };
        })(j);
        div.appendChild(a);
    }
}

function legendClick(level) {
    feelevel = (feelevel == level) ? 0 : level;   // click same band again to reset
    config[currconfig].lastfeelevel = feelevel;
    sethash();
    buildLegend();
    refreshChart();
}

/* ----- top button bars ----- */
function setconfig(cfg) {
    for (var i = 0; i < config.length; i++) {
        var el = document.getElementById("cfg" + i);
        if (el) { el.classList.toggle("selected", i == cfg); }
    }
    currconfig = cfg;
    feelevel = config[currconfig].lastfeelevel;
}

function selectbutton(timespan) {
    for (var i = 0; i < periods.length; i++) {
        var el = document.getElementById("lk" + periods[i]);
        if (el) { el.classList.toggle("selected", periods[i] == timespan); }
    }
}

function button(timespan) {
    currtimespan = timespan;
    zoomWindow = null;
    sethash();
    loadJSONP(config[currconfig].url + timespan + ".js", function(raw){
        loadData(raw);
        buildLegend();
    });
    selectbutton(timespan);
}

function clickby(pos) {
    for (var i = 0; i < bynames.length; i++) {
        var el = document.getElementById("by" + i);
        if (el) { el.classList.toggle("selected", i == pos); }
    }
    currentby = pos;
    if (chart) { refreshChart(); }
    sethash();
}

function sethash() {
    var optfeelevel = "";
    if (feelevel != config[currconfig].feelevel) {
        optfeelevel = "," + config[currconfig].ranges[config[currconfig].show[feelevel]];
    }
    location.hash = "#" + config[currconfig].name + "," + currtimespan + "," + bynames[currentby] + optfeelevel;
}

function makeButton(id, text, onclick) {
    var btn = document.createElement("a");
    btn.text = text;
    btn.onclick = onclick;
    btn.className = "lnk";
    btn.id = id;
    return btn;
}

function main() {
    var divcoins = document.getElementById("configs");
    for (var i = 0; i < config.length; i++) {
        (function(idx){
            divcoins.appendChild(document.createTextNode("​"));
            divcoins.appendChild(makeButton("cfg" + idx, config[idx].name,
                function(){ setconfig(idx); button(currtimespan); }));
        })(i);
    }
    var divp = document.getElementById("periods");
    for (var i = 0; i < periods.length; i++) {
        (function(name){
            divp.appendChild(document.createTextNode("​"));
            divp.appendChild(makeButton("lk" + name, name, function(){ button(name); }));
        })(periods[i]);
    }
    var divby = document.getElementById("by");
    for (var i = 0; i < bynames.length; i++) {
        (function(idx){
            divby.appendChild(document.createTextNode("​"));
            divby.appendChild(makeButton("by" + idx, bynames[idx], function(){ clickby(idx); }));
        })(i);
    }

    window.addEventListener("resize", function(){ if (chart) { chart.resize(); } });

    setconfig(0);
    currentby = 0;
    document.getElementById("by0").classList.add("selected");
    button("24h");
}
