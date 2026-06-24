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
    PROOF OF CONCEPT: the Flot chart re-implemented on Apache ECharts.

    Data model (the part this PoC is exploring):
      * The full-history "all" feed is loaded once and kept as a coarse
        backdrop (allData).  All zooming and panning happens instantly on
        this in-memory data -- no network round-trip during the gesture.
      * Only when the zoom has been stable for ~1s do we fetch higher
        resolution data for the visible window from db.php (fineData).
      * If a later gesture leaves the fine window, we instantly fall back
        to the coarse backdrop so zoom-out stays smooth, then re-settle.
      * The view is always anchored to absolute timestamps, so swapping the
        underlying data never makes the visible window jump.

    The static per-period files (2h.js ... all.js) remain the production
    fast path; here we only use all.js (backdrop) + db.php (detail).
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
var periodMs = {                 // window width per period button, null = full history
    "2h": 7.2e6, "8h": 2.88e7, "24h": 8.64e7, "2d": 1.728e8, "4d": 3.456e8,
    "1w": 6.048e8, "2w": 1.2096e9, "30d": 2.592e9, "3m": 7.776e9,
    "6m": 1.5552e10, "1y": 3.1536e10, "all": null
};

var precisions = [ 0, 3, 3];
var feelevel = 0;
var currconfig = 0;
var currtimespan = "24h";

/* ----- layered data ----- */
var allRaw = null;               // raw full-history rows from all.js (kept for metric switches)
var allData = null;              // coarse backdrop, structured for the current metric: allData[band]=[[t,v],..]
var allInc = 1440;               // sampling interval of allData, in minutes
var fineRaw = null;              // raw rows of the loaded fine window, or null when showing the backdrop
var data = [];                   // currently displayed structured data for the current metric (allData or fine)
var fineRange = null;            // {from,to} of the loaded fine data, or null when showing allData
var baseFrom = 0;                // first timestamp in allData (ms) -- fixed x-axis min
var baseTo = 0;                  // x-axis max (ms): "now", advanced every 5 min by liveRefresh
var programmaticZoom = false;    // guard so our own zoom updates don't re-trigger the handler
var settleTimer, reloadTimer;
var pointerY = null;             // latest cursor y in canvas pixels, for the band-focused tooltip
var TOOLTIP_BANDS = 9;           // how many bands to show around the hovered one
var MAX_BACKDROP_POINTS = 1500;  // cap the in-memory all.js backdrop; db.php gives fine detail on settle

function nowMs() { return Date.now(); }

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

/* ----- data transforms (same logic as the original addData) ----- */
// Sum the raw per-feerate values that fall into displayed band j, for the
// given dataidx (0=count,1=size,2=fee).
function bandAmount(rawRow, dataidx, bandj) {
    var show = config[currconfig].show;
    var ranges = config[currconfig].ranges;
    var arr = rawRow[dataidx + 1];
    function get(array, index) {
        if (index >= array.length) { return 0; }
        if (config[currconfig].inc || index == array.length - 1) { return array[index]; }
        return array[index] - array[index + 1];
    }
    var hi = bandj == show.length - 1 ? ranges.length : show[bandj + 1];
    var amount = 0;
    for (var k = show[bandj]; k < hi; k++) { amount += get(arr, k); }
    return amount;
}

// Build a fresh structured dataset for ONE metric: out[band] = [ [tMs,value], ... ].
// Only the currently displayed metric is materialised -- building all three
// (count/fee/weight) when only one is ever drawn tripled the live memory.
function buildStructured(raw, dataidx) {
    var show = config[currconfig].show;
    var unit = scale(dataidx);
    var out = [];
    for (var j = 0; j < show.length; j++) { out[j] = []; }
    for (var i = 0; i < raw.length; i++) {
        var t = raw[i][0] * 1000;
        for (var j = 0; j < show.length; j++) {
            out[j].push([t, bandAmount(raw[i], dataidx, j) / unit]);
        }
    }
    return out;
}

// Structured data for the current metric, from a set of raw rows.
function structuredFor(raw) {
    return buildStructured(raw, byindex[currentby]);
}

/* ----- ECharts series / tooltip / option ----- */
// Pre-blend a band colour toward white by `alpha` so the area can be painted
// fully opaque.  Stacked bands never overlap, so a translucent fill only ever
// blended against the white background anyway -- but opacity<1 leaves thin white
// anti-aliasing seams between bands, which opaque fills don't.
function bakeColor(hex, alpha) {
    var r = parseInt(hex.slice(1, 3), 16),
        g = parseInt(hex.slice(3, 5), 16),
        b = parseInt(hex.slice(5, 7), 16);
    function mix(c) { return Math.round(c * alpha + 255 * (1 - alpha)); }
    return "rgb(" + mix(r) + "," + mix(g) + "," + mix(b) + ")";
}

function buildSeries() {
    var theData = data;
    var show = config[currconfig].show;
    var priceunit = config[currconfig].priceunit;
    var series = [];
    // Bands below feelevel are skipped entirely (not drawn zeroed), so the
    // native stack starts at the first shown band.
    for (var j = feelevel; j < show.length; j++) {
        // Skip bands that are entirely zero in the current view (e.g. ETH's many
        // empty high-fee bands): a zero band adds nothing to the stack, so not
        // emitting it spares ECharts the per-point ingestion and rasterisation
        // that the profile showed dominating render time.  The tooltip still
        // reads every band from `data`, so its totals are unaffected.
        var bandData = theData[j];
        var nonzero = false;
        for (var p = 0; p < bandData.length; p++) {
            if (bandData[p][1] !== 0) { nonzero = true; break; }
        }
        if (!nonzero) { continue; }
        var name = config[currconfig].ranges[show[j]];
        var legend = j == show.length - 1 ? (name + "+ " + priceunit)
                                           : name + "-" + config[currconfig].ranges[show[j+1]];
        var color = config[currconfig].colors[j];
        var fill = bakeColor(color, 0.66);
        series.push({
            id: "band" + j,
            name: legend,
            type: "line",
            stack: "total",
            stackStrategy: "all",
            showSymbol: false,
            // Non-interactive: we use an axis-trigger tooltip + our own pointerY,
            // never per-band hover.  silent suppresses event dispatch; the actual
            // findHover hit-test cost is killed in silenceBandShapes (silent alone
            // doesn't stop zrender's contain() walk in 5.6).
            silent: true,
            // Opaque fill (baked toward white to keep the translucent look) plus a
            // same-colour stroke on the band's top edge.  The stroke is invisible
            // against its own fill but paints over the thin white anti-aliasing
            // seam ECharts leaves between stacked areas on steep falls.
            lineStyle: { width: 2, color: fill },
            areaStyle: { color: fill, opacity: 1 },
            emphasis: { disabled: true },
            data: theData[j]
        });
    }
    return series;
}

var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
              "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "2019 Jun 27, 14:00" in local time (matching the time axis).  echarts'
// formatTime has no month-name token -- "MMM" there expands to "066".
function fmtTime(ms) {
    var d = new Date(ms);
    function p2(n) { return n < 10 ? "0" + n : "" + n; }
    return d.getFullYear() + " " + MONTHS[d.getMonth()] + " " + d.getDate() +
           ", " + p2(d.getHours()) + ":" + p2(d.getMinutes());
}

function tooltipFormatter(params) {
    if (!params.length) { return ""; }
    var dataidx = byindex[currentby];
    var prec = precisions[dataidx];
    var unit = units(dataidx);
    var show = config[currconfig].show;
    var theData = data;
    if (!theData || !theData[0] || !theData[0].length) { return ""; }
    // The axis pointer can report an index past the end (e.g. the pinned
    // window extends beyond the data, or the data was just swapped between the
    // backdrop and a fine fetch), so clamp it to a valid point.
    var xIndex = params[0].dataIndex;
    if (xIndex == null || xIndex < 0) { xIndex = 0; }
    if (xIndex >= theData[0].length) { xIndex = theData[0].length - 1; }
    var time = fmtTime(theData[0][xIndex][0]);

    // Find which stacked band the cursor sits in (by its y value) and show only a
    // window of bands around it, so a coin with dozens of bands can't produce a
    // tooltip taller than the screen.  Sums stay cumulative across all bands.
    var lastBand = show.length - 1;
    var focus = lastBand;
    if (pointerY != null) {
        var yVal = chart.convertFromPixel({ yAxisIndex: 0 }, pointerY);
        var acc = 0;
        focus = feelevel;
        for (var b = feelevel; b <= lastBand; b++) {
            var r = theData[b] && theData[b][xIndex];
            if (r) { acc += r[1]; }
            focus = b;
            if (yVal <= acc) { break; }
        }
    }
    var win = Math.min(TOOLTIP_BANDS, lastBand - feelevel + 1);
    var lo = focus - (win >> 1);
    if (lo < feelevel) { lo = feelevel; }
    var hi = lo + win - 1;
    if (hi > lastBand) { hi = lastBand; lo = hi - win + 1; }

    function moreRow(n) {
        return "<tr><td colspan='2' style='text-align:center;color:#999'>⋯ " + n + " more ⋯</td></tr>";
    }
    var str = "<strong>" + time + "</strong><table style='border-collapse:collapse'>";
    if (hi < lastBand) { str += moreRow(lastBand - hi); }
    var sum = 0;
    for (var i = lastBand; i >= feelevel; i--) {
        // theData can briefly lag show/feelevel during a data swap (backdrop<->fine,
        // metric or coin switch); skip bands that aren't present yet rather than throw.
        var row = theData[i];
        if (!row || !row[xIndex]) { continue; }
        sum += row[xIndex][1];
        if (i > hi || i < lo) { continue; }   // outside the window: count it, don't list it
        var value = config[currconfig].ranges[show[i]];
        var sw = "<span style='display:inline-block;width:9px;height:9px;margin-right:4px;background:" +
                 config[currconfig].colors[i] + "'></span>";
        var weight = i == focus ? "font-weight:bold;" : "";
        str += "<tr style='" + weight + "'><td>" + sw + (value == 0 ? "total" : value + "+") + ":&nbsp;</td><td style='text-align:right'>" +
               sum.toFixed(prec).replace(/(\d)(?=(\d{3})+$)/g, '$1,') + "&nbsp;" + unit + "</td></tr>";
    }
    if (lo > feelevel) { str += moreRow(lo - feelevel); }
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
            // On touch (no hover) show the tooltip only on tap, so it stops
            // flickering during pinch/scroll; keep hover-to-show on desktop.
            triggerOn: (window.matchMedia && window.matchMedia("(hover: none)").matches)
                       ? "click" : "mousemove|click",
            confine: true,
            axisPointer: { type: "line" },
            formatter: tooltipFormatter,
            textStyle: { fontSize: 12 }
        },
        grid: { left: 60, right: 20, top: 40, bottom: 70 },
        // Fixed to the full all-data range so the scale never jumps when data is
        // swapped, and so zoom-out always has the whole timeline to expand into.
        xAxis: { type: "time", min: baseFrom, max: baseTo, axisLabel: { hideOverlap: true } },
        yAxis: { type: "value", name: units(byindex[currentby]), scale: false },
        dataZoom: [
            { type: "inside", filterMode: "none" },
            // showDataShadow off: the shadow is a full-history silhouette polygon
            // that series.silent doesn't cover, so dragging the slider ran an
            // expensive findHover->contains over it on every touchmove.
            // brushSelect off: removes the slider's interactive brush layer, which
            // is likewise hit-tested on every pointer move.
            { type: "slider", filterMode: "none", height: 22, bottom: 18,
              showDataShadow: false, brushSelect: false }
        ],
        graphic: [{
            type: "text", right: 12, top: 28, z: 0,
            style: { text: "mempool.jhoenicke.de", fontSize: 20, fill: "rgba(0,0,0,0.12)", fontFamily: "Arial" }
        }],
        series: buildSeries()
    };
}

// Mark the rendered band shapes non-interactive so zrender's findHover skips
// them (it only point-in-polygon-tests elements that aren't silent).  Cheap: it
// just flips a flag on the existing display list, no geometry, no re-render.
function noContain() { return false; }

// findHover() in this zrender still runs the band shapes' point-in-polygon test
// even when they're flagged silent (silent only suppresses event dispatch, not
// the geometry test).  That contain() walk over every vertex was the 300ms cost
// on drag/pinch.  Replace contain() with a constant false on the band shapes so
// findHover short-circuits.  Nothing else hit-tests the bands (the tooltip is
// axis-triggered, dataZoom is coordinate-based), and ECharts reuses these
// element objects across renders, so this sticks.
function silenceBandShapes() {
    var zr = chart && chart.getZr();
    var list = zr && zr.storage && zr.storage.getDisplayList ? zr.storage.getDisplayList() : null;
    if (!list) { return; }
    for (var i = 0; i < list.length; i++) {
        var el = list[i], t = el && el.type;
        if (t === "ec-polygon" || t === "ec-polyline" || t === "polygon" || t === "polyline") {
            el.silent = true;
            el.contain = noContain;
        }
    }
}

function setupChart() {
    if (!chart) {
        chart = echarts.init(document.getElementById("chartContainer"), null, { renderer: "canvas" });
        chart.on("datazoom", onDataZoom);
        // After every render, neutralise the band shapes' hit-testing so zrender's
        // findHover doesn't run a 300ms point-in-polygon over every band on each
        // drag/pinch.  See silenceBandShapes.
        chart.getZr().on("rendered", silenceBandShapes);
        // Track the cursor/touch y so the tooltip can focus on the right band.
        // mousedown covers a tap (which may emit no mousemove) for click-trigger.
        chart.getZr().on("mousemove", function(e) { pointerY = e.offsetY; });
        chart.getZr().on("mousedown", function(e) { pointerY = e.offsetY; });
        chart.getZr().on("globalout", function() { pointerY = null; });
    }
    chart.setOption(baseOption(), { notMerge: true });
}

// Re-render series + title + y-axis without touching the zoom window.
// replaceMerge on 'series' so a higher feelevel (fewer bands) actually drops the
// now-hidden series instead of leaving them merged in from the previous render.
function refreshChart() {
    chart.setOption({
        title: { text: title(byindex[currentby]) },
        yAxis: { name: units(byindex[currentby]) },
        series: buildSeries()
    }, { replaceMerge: ["series"] });
}

// Rebuild the displayed data for the current metric from the raw rows we kept.
function rebuildForMetric() {
    if (allRaw) { allData = structuredFor(allRaw); }
    data = fineRaw ? structuredFor(fineRaw) : allData;
}

/* ----- zoom helpers ----- */
function getWindow() {
    var axis = chart.getModel().getComponent("xAxis").axis;
    var extent = axis.scale.getExtent();   // [minMs, maxMs] currently shown
    return { from: extent[0], to: extent[1] };
}

// Pin the view to an absolute time window so it survives a data swap.
function pinZoom(from, to) {
    programmaticZoom = true;
    chart.dispatchAction({ type: "dataZoom", startValue: from, endValue: to });
}

// How many points per band are worth drawing across the current window: never
// more than the chart can resolve (~1 point/px).  A phone is ~360px wide, so
// this alone cuts the old fixed ~1440-points-per-band budget several-fold --
// fewer points means less memory and far less to repaint on every pan/zoom.
function targetPoints() {
    var w = (chart && chart.getWidth()) || 800;
    return Math.min(1000, Math.max(150, Math.round(w)));
}

// Sampling interval, in whole minutes, that suits a window of the given width.
function incrementFor(spanMs) {
    var inc = Math.floor(spanMs / (targetPoints() * 60000));
    return inc < 1 ? 1 : inc;
}

// Interval (minutes) of whatever data is currently displayed.
function currentInc() {
    var s = data[0];
    return s.length < 2 ? allInc : (s[1][0] - s[0][0]) / 60000;
}

/* ----- display source switching ----- */
function showAll() {
    data = allData;
    fineRange = null;
    fineRaw = null;
}

/* ----- loading ----- */
// Drop whole rows (keeping every band aligned) so the backdrop never exceeds
// maxPoints.  all.js is sampled every 6h, but over years that is still ~14k
// points/band -- far more than the screen can show, and it is what gets
// repainted during every pan/zoom gesture.  Fine detail comes from db.php once
// the zoom settles, so a coarse backdrop is all we need here.
function downsampleRows(raw, maxPoints) {
    if (raw.length <= maxPoints) { return raw; }
    var stride = Math.ceil(raw.length / maxPoints);
    var out = [];
    for (var i = 0; i < raw.length; i += stride) { out.push(raw[i]); }
    var last = raw[raw.length - 1];
    if (out[out.length - 1] !== last) { out.push(last); }   // keep the present edge
    return out;
}

// Load the coarse full-history backdrop once per coin.
function loadAllData(cb) {
    loadJSONP(config[currconfig].url + "all.js", function(raw) {
        allRaw = downsampleRows(raw, MAX_BACKDROP_POINTS);
        allData = structuredFor(allRaw);
        var s0 = allData[0];
        baseFrom = s0[0][0];
        baseTo = nowMs();               // right edge tracks the present, not the last all sample
        allInc = s0.length < 2 ? 1440 : (s0[1][0] - s0[0][0]) / 60000;
        data = allData;
        fineRange = null;
        fineRaw = null;
        if (cb) { cb(); }
    });
}

// Fetch higher-resolution data for the visible window (plus margin) and show it.
function loadFine(visFrom, visTo) {
    var span = visTo - visFrom;
    var inc = incrementFor(span);
    var margin = span * 0.5;
    var qfrom = Math.max(baseFrom, visFrom - margin);
    var qto = Math.min(baseTo, visTo + margin);
    loadJSONP(config[currconfig].url +
              "db.php?s=" + Math.floor(qfrom/1000) +
              "&e=" + Math.floor(qto/1000) +
              "&i=" + inc, function(raw) {
        if (!raw || !raw.length) { return; }
        fineRaw = raw;
        data = structuredFor(fineRaw);
        fineRange = { from: qfrom, to: qto };
        refreshChart();
        pinZoom(visFrom, visTo);
    });
}

/* ----- the settle / coverage logic ----- */
// Called continuously while the user zooms/pans.  Keeps the gesture smooth
// (instant fallback to the backdrop) and schedules a reload once it stops.
function onDataZoom() {
    if (programmaticZoom) { programmaticZoom = false; return; }
    var w = getWindow();
    // If we drifted outside the loaded fine window, fall back to the coarse
    // backdrop immediately so zoom-out / pan never hits an empty edge.
    if (fineRange && (w.from < fineRange.from || w.to > fineRange.to)) {
        showAll();
        refreshChart();
        pinZoom(w.from, w.to);
    }
    clearTimeout(settleTimer);
    settleTimer = setTimeout(onSettle, 1000);   // only reload when the zoom holds ~1s
}

function onSettle() {
    if (!chart) { return; }
    var w = getWindow();
    var ideal = incrementFor(w.to - w.from);    // minutes the window wants
    if (ideal >= allInc * 0.8) {
        // wide enough that the coarse backdrop already suffices
        if (fineRange) { showAll(); refreshChart(); pinZoom(w.from, w.to); }
        return;
    }
    // need finer data; skip if the current fine data already covers it well
    if (fineRange && w.from >= fineRange.from && w.to <= fineRange.to &&
        currentInc() <= ideal * 1.8) {
        return;
    }
    loadFine(w.from, w.to);
}

/* ----- live refresh: advance the right edge to "now" every 5 minutes ----- */
function scheduleReload() {
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(liveRefresh, 300000);   // matches the server autoupdate cadence
}
function liveRefresh() {
    if (chart) {
        var prevTo = baseTo;
        baseTo = nowMs();                       // move the fixed scale's right edge to now
        var w = getWindow();
        // if the view was tracking the present edge, keep it pinned to "now";
        // otherwise leave the user's window where it is.
        var atPresent = w.to >= prevTo - 6 * 60000;
        var to = atPresent ? baseTo : w.to;
        // update axis max and re-anchor the window atomically (absolute values,
        // so the moved max can't make the window drift)
        chart.setOption({
            xAxis: { max: baseTo },
            dataZoom: [ { startValue: w.from, endValue: to },
                        { startValue: w.from, endValue: to } ]
        });
        // pull the newest samples when viewing the present at fine resolution
        if (atPresent && fineRange) {
            loadFine(w.from, to);
        }
    }
    scheduleReload();
}

/* ----- top button bars ----- */
function selectbutton(timespan) {
    for (var i = 0; i < periods.length; i++) {
        var el = document.getElementById("lk" + periods[i]);
        if (el) { el.classList.toggle("selected", periods[i] == timespan); }
    }
}

// Set the visible window to a period, instantly on the backdrop, then settle.
function setView(timespan) {
    currtimespan = timespan;
    sethash();
    var to = baseTo;
    var from = periodMs[timespan] != null ? to - periodMs[timespan] : baseFrom;
    from = Math.max(baseFrom, from);
    showAll();
    setupChart();          // creates the chart on first call, full re-render afterwards
    pinZoom(from, to);
    clearTimeout(settleTimer);
    settleTimer = setTimeout(onSettle, 300);    // explicit intent: fetch detail promptly
}

function button(timespan) {
    selectbutton(timespan);
    setView(timespan);
}

function selectCoin(cfg) {
    for (var i = 0; i < config.length; i++) {
        var el = document.getElementById("cfg" + i);
        if (el) { el.classList.toggle("selected", i == cfg); }
    }
    currconfig = cfg;
    feelevel = config[currconfig].lastfeelevel;
    loadAllData(function() {
        buildLegend();
        setView(currtimespan);
        scheduleReload();
    });
}

function clickby(pos) {
    for (var i = 0; i < bynames.length; i++) {
        var el = document.getElementById("by" + i);
        if (el) { el.classList.toggle("selected", i == pos); }
    }
    currentby = pos;
    if (chart) { rebuildForMetric(); refreshChart(); }
    sethash();
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

/* ----- hash / buttons / bootstrap ----- */
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
            divcoins.appendChild(makeButton("cfg" + idx, config[idx].name, function(){ selectCoin(idx); }));
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

    currentby = 0;
    document.getElementById("by0").classList.add("selected");
    selectCoin(0);
}
