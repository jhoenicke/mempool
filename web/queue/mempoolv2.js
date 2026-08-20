/*
    Bitcoin Mempool Visualization - ECharts edition
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
    The mempool chart, re-implemented on Apache ECharts (formerly a Flot
    chart; see old.html/mempool.js for the previous version).

    Data model:
      * Clicking a period button (2h ... all) loads that period's own
        static file (e.g. 24h.js) directly -- same as the production Flot
        chart -- so the initial range shown is never a database query.
      * "all.js" (the full-history feed) is NOT loaded eagerly.  Once the
        selected period's own file succeeds, a "30d" medium backdrop is
        fetched in the background (skipped if the selected period is
        already >= 30d) so zooming out a moderate amount stays instant.
        "all.js" itself is only fetched lazily, the moment a gesture
        actually pans/zooms past whatever's currently loaded.
      * The x-axis is fixed to each coin's true full-history bounds from the
        very first render (config[].historyStart), even before "all.js" has
        loaded, so dataZoom can drag/pinch out that far immediately; only
        the *data* for the far-out region is missing until the lazy fetch
        lands (a brief sparse/flat patch, not an axis jump).
      * The chart is always fed a data slice restricted to the visible
        window (plus one padding point on each edge) rather than a tier's
        full extent, so the y-axis auto-scale reflects only what's on
        screen -- see sliceRaw/setActive.
      * Only once the user actually starts an interactive zoom/pan (drag,
        pinch, slider) and it has been stable for ~1s do we fetch matching
        resolution data for the visible window from db.php (detailTier).
      * If a later gesture leaves the loaded window, we instantly fall back
        to the best available backdrop tier so zoom-out stays smooth, then
        re-settle.
      * The view is always anchored to absolute timestamps, so swapping the
        underlying data never makes the visible window jump.
*/

var chart;                       // the ECharts instance
var bynames = [ "count", "fee", "weight" ];
var byindex = [ 0, 2, 1 ];
var currentby = 0;
// Distinct config[].classname values.  Elements throughout the page (the
// explanatory text, the donation addresses) are tagged with these class
// names and shown/hidden to match whichever coin's chart is selected --
// see applyCoinVisibility/setdonate.
var classes = [ "btc", "eth", "bch", "doge", "ltc", "dash" ];
var config = [
    {"name":"BTC",
     "classname": "btc",
     "donatebutton": true,
     "title":"Bitcoin Core 30.2.  Huge mempool limit and no timeout.",
     "url":"https://johoe.jochen-hoenicke.de/queue/2/",
     "historyStart": 1481883544,
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
    {"name":"BTC (default mempool)",
     "classname": "btc",
     "title":"Bitcoin Core 30.2 with default mempool settings (300 MB + 14 days timeout).",
     "url":"https://electrum.jochen-hoenicke.de/btc/",
     "historyStart": 1493426623,
     "sizeunit":"vMB",
     "priceunit":"sat/vB",
     "symbol":"BTC",
     "satPerUnit": 100000000.0,
     "feelevel": 1,
     "lastfeelevel": 1,
     "ranges": [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 17, 20, 25, 30, 40, 50, 60, 70, 80, 100, 120, 140, 170, 200, 250, 300, 400, 500, 600, 700, 800, 1000, 1200, 1400, 1700, 2000, 2500, 3000, 4000, 5000, 6000, 7000, 8000, 10000 ],
     "show":   [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29 ],
     "colors": [
   "#535154",
   "#00c000", "#00e000", "#00f000", "#80e080",
   "#404000", "#606000", "#808000", "#a0a000", "#c0c000", "#e0e000", "#f0f000", "#e0e020", "#e0e040", "#e0e060", "#e0e080", "#e0e0a0",
   "#400000", "#600000", "#800000", "#a00000", "#c00000", "#e00000", "#f00000", "#e02020", "#e04040", "#e06060", "#e08080", "#e0a0a0",
   "#000000"
             ],
     "inc": true},
    {"name":"ETH",
     "classname":"eth",
     "donatebutton": true,
     "title":"geth 1.17.1 + nimbus 26.3.0 with 150k slots",
     "url":"https://jochen-hoenicke.de/queue/eth4/",
     "historyStart": 1607367640,
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
     "inc": true},
    {"name":"BCH",
     "classname": "bch",
     "donatebutton": true,
     "title":"Bitcoin Cash - BCHN 29.0.0.",
     "url":"https://johoe.jochen-hoenicke.de/queue/cash/",
     "historyStart": 1519122121,
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
   "#000000" ],
     "inc": true},
    {"name":"DOGE",
     "classname": "doge",
     "donatebutton": true,
     "title":"Dogecoin 1.14.9",
     "url":"https://johoe.jochen-hoenicke.de/queue/doge/",
     "historyStart": 1613471702,
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
   "#808000", "#989800", "#b0b000", "#e0e060",
   "#000000"],
     "inc": true},
    {"name":"LTC",
     "classname": "ltc",
     "donatebutton": true,
     "title":"Litecoin Core 0.21.4",
     "url":"https://johoe.jochen-hoenicke.de/queue/litecoin/",
     "historyStart": 1513803928,
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
   "#808000", "#989800", "#b0b000", "#c8c800",
   "#000000"
                ],
     "inc": true},
    {"name":"DASH",
     "classname": "dash",
     "donatebutton": true,
     "title":"Dash Core v23.1.1 with default memory limit",
     "url":"https://johoe.jochen-hoenicke.de/queue/dash/",
     "historyStart": 1539912876,
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

/* ----- layered data -----
   Three "tiers" of raw rows may be known at once, each {raw,from(ms),to(ms),inc(minutes)}:
     detailTier - the selected period's own file, or a db.php window once the user zooms
     medTier    - the "30d" medium backdrop, loaded eagerly once detailTier succeeds
                  (skipped if the selected period is already >= 30d)
     allTier    - the full-history backdrop, loaded lazily only once the user zooms/pans
                  past whatever's currently loaded
   `data` (fed to the chart) is always a WINDOWED SLICE of whichever tier is
   currently active, never a tier's full extent -- see sliceRaw/setActive. */
var allTier = null, medTier = null, detailTier = null;   // per-coin; reset on coin switch
var medLoading = false, allLoading = false;              // in-flight guards, per-coin
var activeRaw = null;             // raw rows `data` is currently sliced from (some tier's .raw)
var activeInc = 1440;             // that source's sampling interval, in minutes
var activeWindow = null;          // {from,to} (ms) that `data` was sliced to
var lastSliceAt = 0;              // throttle timestamp for re-slicing during a live gesture
var RESLICE_MIN_MS = 200;         // min ms between re-slices while dragging/pinching
var MEDIUM_PERIOD = "30d";
var data = [];                    // currently displayed structured data for the current metric
var baseFrom = 0;                 // fixed x-axis min (ms) -- config[currconfig].historyStart*1000
var baseTo = 0;                   // x-axis max (ms): "now", advanced every 5 min by liveRefresh
var programmaticZoom = false;    // guard so our own zoom updates don't re-trigger the handler
var settleTimer, reloadTimer;
var pointerY = null;             // latest cursor y in canvas pixels, for the band-focused tooltip
var TOOLTIP_BANDS = 9;           // how many bands to show around the hovered one
var MAX_BACKDROP_POINTS = 1500;  // cap the in-memory backdrop tiers; db.php gives fine detail on settle

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

/* ----- JSONP loader ----- */
// All static/db.php feeds are wrapped in a literal `call(...)` -- the payload
// can't carry a per-request callback name -- so only one script can own the
// global `window.call` at a time.  A loadJSONP callback can itself trigger
// another loadJSONP synchronously (e.g. setView loads a period file from
// inside loadAllData's own completion handler); without queuing, the second
// script overwrites window.call before the first script's wrapper gets to
// clean up, and that cleanup then deletes the SECOND script's callback,
// leaving it stranded ("call is not defined") once it actually loads. Queue
// requests and only ever have one script tag in flight.
var jsonpQueue = [];
var jsonpBusy = false;
// A static file (or db.php) can transiently 404 -- e.g. the ramdisk backing it
// just got cleared (logind's RemoveIPC wipes /dev/shm on logout, a reboot, ...)
// -- and the per-minute cron job that (re)generates it hasn't run yet.  Retry
// after a minute rather than leaving the chart broken, a few times to cover a
// slow full rebuild, then give up.
var JSONP_RETRY_DELAY = 60000;
var JSONP_MAX_RETRIES = 5;
function loadJSONP(url, callback) {
    jsonpQueue.push({ url: url, callback: callback, attempt: 0 });
    pumpJSONP();
}
function pumpJSONP() {
    if (jsonpBusy || !jsonpQueue.length) { return; }
    jsonpBusy = true;
    var job = jsonpQueue.shift();
    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = job.url;
    var settled = false;
    function cleanup() {
        if (settled) { return; }
        settled = true;
        document.getElementsByTagName('head')[0].removeChild(script);
        script = null;
        delete window['call'];
        jsonpBusy = false;
    }
    window['call'] = function(data){
        cleanup();
        job.callback(data);   // may itself call loadJSONP -- busy is already clear
        pumpJSONP();
    };
    script.onerror = function() {
        cleanup();
        if (job.attempt < JSONP_MAX_RETRIES) {
            console.warn("retrying " + job.url + " in a minute (attempt " + (job.attempt + 1) + ")");
            setTimeout(function() {
                jsonpQueue.push({ url: job.url, callback: job.callback, attempt: job.attempt + 1 });
                pumpJSONP();
            }, JSONP_RETRY_DELAY);
        } else {
            console.warn("giving up on " + job.url + " after " + job.attempt + " retries");
        }
        pumpJSONP();
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
    // Emit EVERY band, always, in the same order with the same id.  Bands below
    // feelevel are hidden (zeroed + transparent) rather than removed, so the
    // series set never changes between renders.  A variable set updated via
    // replaceMerge let ECharts mismatch band data/colour on zoom and feelevel
    // changes (colours appeared scrambled); a stable set can't.
    for (var j = 0; j < show.length; j++) {
        var visible = j >= feelevel;
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
            // seam ECharts leaves between stacked areas on steep falls.  Hidden
            // bands are zeroed so they drop out of the stack but keep its baseline.
            lineStyle: { width: visible ? 2 : 0, color: fill },
            areaStyle: { color: fill, opacity: visible ? 1 : 0 },
            emphasis: { disabled: true },
            data: visible ? theData[j] : theData[j].map(function(pt) { return [pt[0], 0]; })
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
        // Fixed to the coin's true full-history range (baseFrom comes from
        // config[].historyStart, not from loading all.js) so the scale never
        // jumps when data is swapped, and zoom-out always has the whole
        // timeline to expand into -- even before all.js itself has loaded.
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
            type: "text", right: 12, top: 48, z: 0,
            style: { text: "mempool.jhoenicke.de", fontSize: 28, fill: "rgba(0,0,0,0.22)", fontFamily: "Arial" }
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

// Re-render series + title + y-axis without touching the zoom window.  The
// series set is stable (every band, every render), so a plain merge updates each
// band in place by id -- no replaceMerge, which was scrambling band colours.
function refreshChart() {
    chart.setOption({
        title: { text: title(byindex[currentby]) },
        yAxis: { name: units(byindex[currentby]) },
        series: buildSeries()
    });
}

// Rebuild the displayed data for the current metric from the raw rows we kept.
// Re-slice whatever raw source is currently active at whatever window is
// currently on screen -- correct in every mid-transition state (backdrop
// showing while a period file is in flight, detail showing, nothing loaded
// yet) without tracking two separate structured caches.
function rebuildForMetric() {
    var w = chart ? getWindow() : activeWindow;
    if (activeRaw && w) {
        data = structuredFor(sliceRaw(activeRaw, w.from, w.to));
        activeWindow = w;
    } else {
        data = structuredFor([]);
    }
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

/* ----- tiers: raw source + extent + resolution, and the windowed slice fed to the chart ----- */
// {raw, from(ms), to(ms), inc(minutes)} -- from/to are the raw rows' own
// timestamp extent; inc is the mean sampling interval actually kept (after
// any downsampling), used to judge whether a tier's resolution suffices.
function tierFor(raw) {
    var from = raw[0][0] * 1000, to = raw[raw.length - 1][0] * 1000;
    var inc = raw.length < 2 ? 1440 : (to - from) / (raw.length - 1) / 60000;
    return { raw: raw, from: from, to: to, inc: inc };
}

// First index i with raw[i][0] >= tSec (raw sorted ascending), else raw.length.
function lowerBound(raw, tSec) {
    var lo = 0, hi = raw.length;
    while (lo < hi) {
        var mid = (lo + hi) >> 1;
        if (raw[mid][0] < tSec) { lo = mid + 1; } else { hi = mid; }
    }
    return lo;
}

// The window-restriction requirement: return only the rows inside [from,to]
// (ms), plus exactly one row of padding before/after when available, so the
// drawn line/area doesn't look chopped off right at the boundary.  Feeding
// only this slice to the chart (instead of a tier's full extent) is what
// keeps the y-axis auto-scale matching what's actually on screen.
function sliceRaw(raw, from, to) {
    if (!raw || !raw.length) { return []; }
    var i0 = lowerBound(raw, from / 1000);
    var i1 = lowerBound(raw, to / 1000 + 1) - 1;
    var start = i0 > 0 ? i0 - 1 : 0;
    var end = i1 + 2 < raw.length ? i1 + 2 : raw.length;
    if (end <= start) { end = start + 1; }
    return raw.slice(start, end);
}

// The one place `data` is assigned: slice `tier`'s raw rows to [from,to] and
// remember what's currently on screen so metric switches / legend clicks can
// rebuild consistently.
function setActive(tier, from, to) {
    activeRaw = tier.raw;
    activeInc = tier.inc;
    activeWindow = { from: from, to: to };
    data = structuredFor(sliceRaw(tier.raw, from, to));
}

function windowMatches(w) {
    return activeWindow &&
        Math.abs(w.from - activeWindow.from) < 1000 &&
        Math.abs(w.to - activeWindow.to) < 1000;
}

// Re-slice+redraw only if the active source or window actually changed.
function ensureSlice(tier, w) {
    if (activeRaw === tier.raw && windowMatches(w)) { return false; }
    setActive(tier, w.from, w.to);
    refreshChart();
    return true;
}

// The finest loaded backdrop tier that covers window w's left edge (the
// right edge is always close to "now" for both backdrop files, so only the
// left edge needs checking).
function bestBackdrop(w) {
    if (medTier && w.from >= medTier.from - 60000) { return medTier; }
    if (allTier) { return allTier; }
    if (medTier) { return medTier; }
    return detailTier;
}

/* ----- display source switching ----- */
// Show the best available backdrop for window w, sliced to that window.
function showBackdrop(w) {
    // Compute bd BEFORE clearing detailTier: bestBackdrop's last-resort
    // fallback is the current detailTier, and if that's captured only after
    // nulling it, a lone detail tier (no medium/all loaded yet) would be
    // discarded outright instead of used as a sparse stand-in.
    var bd = bestBackdrop(w);
    detailTier = null;
    if (bd) {
        ensureSlice(bd, w);
    } else {
        data = structuredFor([]);
        if (chart) { refreshChart(); }
    }
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

// Is the medium ("30d") backdrop worth prefetching for this period? Not if
// the period is itself already that wide or wider (30d/3m/6m/1y), and not
// for "all" (periodMs[timespan] is null there).
function needsMedium(timespan) {
    var span = periodMs[timespan];
    return span != null && span < periodMs[MEDIUM_PERIOD];
}

// Refresh the displayed backdrop after a medium/all tier finishes loading,
// but only if detail (the selected period, or a db.php fetch) isn't already
// authoritative -- a backdrop tier arriving late must never override it.
function maybeRefreshBackdrop() {
    if (!chart || detailTier) { return; }
    showBackdrop(getWindow());
}

// Load the "30d" medium backdrop in the background. Guarded on coin only --
// it's a per-coin dataset, valid regardless of which period is selected by
// the time it lands.
function loadMedTier() {
    if (medTier || medLoading) { return; }
    medLoading = true;
    var coin = currconfig;
    loadJSONP(config[coin].url + MEDIUM_PERIOD + ".js", function(raw) {
        medLoading = false;
        if (coin !== currconfig || !raw || !raw.length) { return; }
        medTier = tierFor(downsampleRows(raw, MAX_BACKDROP_POINTS));
        maybeRefreshBackdrop();
    });
}

// Load the full-history backdrop. Lazy: only called once a gesture actually
// pans/zooms past whatever's currently loaded (see maybeLoadAllTier), or
// directly when "all" itself is the selected period (cb installs it as the
// detail tier too).
function loadAllTier(cb) {
    if (allTier) { if (cb) { cb(); } return; }
    if (allLoading) { return; }
    allLoading = true;
    var coin = currconfig;
    loadJSONP(config[coin].url + "all.js", function(raw) {
        allLoading = false;
        if (coin !== currconfig || !raw || !raw.length) { return; }
        allTier = tierFor(downsampleRows(raw, MAX_BACKDROP_POINTS));
        if (cb) { cb(); } else { maybeRefreshBackdrop(); }
    });
}

// Once the user's window reaches data we don't have yet (past the medium
// tier if it's loaded, else past the detail tier), fetch the full backdrop.
// The axis already spans the true history (baseFrom comes from config), so
// this is purely about data coverage, not axis bounds.
function maybeLoadAllTier(w) {
    if (allTier || allLoading) { return; }
    var covered = medTier ? medTier.from : (detailTier ? detailTier.from : baseTo);
    if (w.from < covered - 60000) { loadAllTier(null); }
}

// Show freshly loaded detail rows (from either db.php or a static period
// file) as the current data, sliced to the visible window [visFrom,visTo].
// rangeFrom/rangeTo is the wider extent the rows actually cover (loadFine's
// margin) -- kept on detailTier so a small subsequent pan needs no refetch,
// but never fed to the chart beyond what's visible.
function applyDetailData(raw, rangeFrom, rangeTo, visFrom, visTo) {
    detailTier = { raw: raw, from: rangeFrom, to: rangeTo,
                    inc: raw.length < 2 ? 1440 : (rangeTo - rangeFrom) / (raw.length - 1) / 60000 };
    setActive(detailTier, visFrom, visTo);
    refreshChart();
}

// Fetch higher-resolution data for the visible window (plus margin) and show it.
// Only called once the user is actually mid-gesture (see onDataZoom/onSettle
// below) -- never on initial load or a plain period-button click.
function loadFine(visFrom, visTo) {
    var span = visTo - visFrom;
    var inc = incrementFor(span);
    var margin = span * 0.5;
    var qfrom = Math.max(baseFrom, visFrom - margin);
    var qto = Math.min(baseTo, visTo + margin);
    var coin = currconfig;
    loadJSONP(config[coin].url +
              "db.php?s=" + Math.floor(qfrom/1000) +
              "&e=" + Math.floor(qto/1000) +
              "&i=" + inc, function(raw) {
        // Drop stale responses if the coin changed while this was in flight.
        if (coin !== currconfig || !raw || !raw.length) { return; }
        applyDetailData(raw, qfrom, qto, visFrom, visTo);
        pinZoom(visFrom, visTo);
    });
}

// Load the pre-built static file for a period button (e.g. 24h.js) --
// production's own fast path, so the initial range for a period never costs
// a database query.  The file's own timestamp extent is drawn as-is.
function loadPeriodFile(timespan) {
    var coin = currconfig;
    loadJSONP(config[coin].url + timespan + ".js", function(raw) {
        // Drop stale responses if the coin or period changed while in flight.
        if (coin !== currconfig || currtimespan !== timespan || !raw || !raw.length) { return; }
        var from = raw[0][0] * 1000, to = raw[raw.length - 1][0] * 1000;
        applyDetailData(raw, from, to, from, to);
        pinZoom(from, to);
    });
}

/* ----- the settle / coverage logic ----- */
// Called continuously while the user zooms/pans.  Keeps the gesture smooth
// (instant re-slice, throttled) and schedules a reload once it stops.
function onDataZoom() {
    if (programmaticZoom) { programmaticZoom = false; return; }
    var w = getWindow();
    maybeLoadAllTier(w);   // lazily fetch all.js once we've panned past what's loaded
    if (!detailTier || w.from < detailTier.from || w.to > detailTier.to) {
        // Outside (or no) detail: fall back to the best backdrop, throttled
        // so a fast gesture doesn't rebuild the series on every tick -- see
        // the sign-off note above showBackdrop/ensureSlice's definitions.
        if (nowMs() - lastSliceAt >= RESLICE_MIN_MS) {
            lastSliceAt = nowMs();
            showBackdrop(w);
            pinZoom(w.from, w.to);
        }
    } else if (!windowMatches(w)) {
        // Inside detail, but the window moved: keep the slice (and so the
        // y-axis) tracking the visible window as the gesture continues.
        if (nowMs() - lastSliceAt >= RESLICE_MIN_MS) {
            lastSliceAt = nowMs();
            ensureSlice(detailTier, w);
            pinZoom(w.from, w.to);
        }
    }
    clearTimeout(settleTimer);
    settleTimer = setTimeout(onSettle, 1000);   // only reload when the zoom holds ~1s
}

function onSettle() {
    if (!chart) { return; }
    var w = getWindow();
    maybeLoadAllTier(w);
    var ideal = incrementFor(w.to - w.from);    // minutes the window wants
    var bd = bestBackdrop(w);
    if (bd && bd !== detailTier && ideal >= bd.inc * 0.8) {
        // wide enough that this backdrop's own resolution already suffices
        detailTier = null;
        ensureSlice(bd, w);
        return;
    }
    // need finer data; skip if the current detail already covers it well
    if (detailTier && w.from >= detailTier.from && w.to <= detailTier.to &&
        detailTier.inc <= ideal * 1.8) {
        ensureSlice(detailTier, w);
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
        // keep the slice matching the (possibly widened) window
        var src = detailTier || bestBackdrop({ from: w.from, to: to });
        if (src) { ensureSlice(src, { from: w.from, to: to }); }
        // pull the newest samples when viewing the present at fine resolution
        if (atPresent && detailTier) {
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

// Set the visible window to a period: instantly on whatever backdrop is
// already loaded (or empty, on a cold load), then swap in that period's own
// static file (e.g. 24h.js) once it loads -- a plain file fetch, never a
// database query.  db.php is only ever reached via an actual interactive
// zoom/pan, see onDataZoom/onSettle below.  Period buttons are always
// immediately actionable -- there's no "wait for all.js first" gate.
function setView(timespan) {
    currtimespan = timespan;
    sethash();
    clearTimeout(settleTimer);
    baseTo = nowMs();
    var span = periodMs[timespan];
    var from = Math.max(baseFrom, span != null ? baseTo - span : baseFrom);
    showBackdrop({ from: from, to: baseTo });
    setupChart();          // creates the chart on first call, full re-render afterwards
    pinZoom(from, baseTo);

    if (timespan === "all") {
        // The exception mentioned in the request: "all" is fetched directly,
        // no medium tier involved, and it doubles as the detail tier so a
        // later zoom-out from "all" can never re-fetch (maybeLoadAllTier is
        // guarded on allTier already being set).
        if (allTier) {
            applyDetailData(allTier.raw, allTier.from, allTier.to, allTier.from, allTier.to);
            pinZoom(allTier.from, allTier.to);
        } else {
            loadAllTier(function() {
                if (currtimespan !== "all") { return; }
                applyDetailData(allTier.raw, allTier.from, allTier.to, allTier.from, allTier.to);
                pinZoom(allTier.from, allTier.to);
            });
        }
        return;
    }
    loadPeriodFile(timespan);
    if (needsMedium(timespan)) { loadMedTier(); }
}

function button(timespan) {
    selectbutton(timespan);
    setView(timespan);
}

// Reset all per-coin tier/window state; called from selectCoin right after
// currconfig is updated, since baseFrom and data's band count both depend on it.
function resetTiers() {
    allTier = null; medTier = null; detailTier = null;
    medLoading = false; allLoading = false;
    activeRaw = null; activeInc = 1440; activeWindow = null;
    lastSliceAt = 0;
    baseFrom = config[currconfig].historyStart * 1000;
    clearTimeout(settleTimer);
    clearTimeout(reloadTimer);
    data = structuredFor([]);
}

// Copy an <input>'s value to the clipboard (used by the donation box's
// "copy address" link).
function copyToClip(fldname) {
    var fld = document.getElementById(fldname);
    fld.select();
    fld.setSelectionRange(0, 9999);
    document.execCommand("copy");
}

// Show only the page text/donation elements tagged with the currently
// selected coin's classname; hide the same for every other known classname.
function applyCoinVisibility() {
    var mine = config[currconfig].classname;
    for (var i = 0; i < classes.length; i++) {
        if (classes[i] === mine) { continue; }
        var hide = document.getElementsByClassName(classes[i]);
        for (var j = hide.length - 1; j >= 0; j--) { hide[j].style.display = 'none'; }
    }
    var show = document.getElementsByClassName(mine);
    for (var k = show.length - 1; k >= 0; k--) { show[k].style.display = 'inline'; }
}

// Pick which coin's donation address is displayed. Independent of the
// chart's selected coin (selectCoin resets it to match by default, but the
// user can then pick a different donate button without changing the chart).
function setdonate(coin) {
    for (var i = 0; i < classes.length; i++) {
        var btn = document.getElementById("don" + classes[i]);
        if (btn) { btn.classList.remove("selected"); }
        var els = document.getElementsByClassName("do" + classes[i]);
        for (var j = 0; j < els.length; j++) { els[j].style.display = classes[i] == coin ? 'inline' : 'none'; }
    }
    var sel = document.getElementById("don" + coin);
    if (sel) { sel.classList.add("selected"); }
}

// hashfeelevel, if given, is the fee-rate threshold restored from the URL
// hash (see main()); otherwise the coin's last-used feelevel is kept.
function selectCoin(cfg, hashfeelevel) {
    for (var i = 0; i < config.length; i++) {
        var el = document.getElementById("cfg" + i);
        if (el) { el.classList.toggle("selected", i == cfg); }
    }
    currconfig = cfg;
    feelevel = config[currconfig].lastfeelevel;
    if (hashfeelevel != null && hashfeelevel >= 0) {
        var idx = config[currconfig].show.findIndex(function(show) {
            return config[currconfig].ranges[show] >= hashfeelevel;
        });
        feelevel = idx >= 0 ? idx : config[currconfig].feelevel;
    }
    applyCoinVisibility();
    setdonate(config[currconfig].classname);
    resetTiers();
    buildLegend();
    setView(currtimespan);
    scheduleReload();
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
    // No data rebuild needed: bandAmount doesn't depend on feelevel, and
    // buildSeries already zeroes bands below it -- refreshChart alone is
    // what shrinks the stacked total (and so the y-axis) accordingly.
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

function findcoin(name) {
    var idx = /^\d+$/.test(name) ? Number(name) :
        config.findIndex(function(item) { return item.name == decodeURIComponent(name); });
    return idx < 0 || idx >= config.length ? 0 : idx;
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
    var divdonate = document.getElementById("donatecoins");
    for (var i = 0; i < config.length; i++) {
        (function(idx){
            divcoins.appendChild(document.createTextNode("​"));
            divcoins.appendChild(makeButton("cfg" + idx, config[idx].name, function(){ selectCoin(idx); }));
            if (config[idx].donatebutton && divdonate) {
                divdonate.appendChild(document.createTextNode("​"));
                divdonate.appendChild(makeButton("don" + config[idx].classname, config[idx].name,
                    function(){ setdonate(config[idx].classname); }));
            }
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

    // Restore coin/period/metric/feelevel from the URL hash (written by
    // sethash() on every change) so a reload lands back where the user left
    // off instead of resetting to the defaults.
    var hashconfig = 0, hashtimespan = "24h", hashby = bynames.indexOf("weight"), hashfeelevel = -1;
    if (location.hash.length > 0) {
        var args = location.hash.substring(1).split(",");
        var argindex = 0;
        if (argindex + 1 < args.length) { hashconfig = findcoin(args[argindex]); argindex++; }
        if (argindex < args.length) { hashtimespan = args[argindex]; argindex++; }
        if (argindex < args.length) {
            var by = bynames.indexOf(args[argindex]);
            if (by >= 0) { hashby = by; argindex++; }
        }
        if (argindex < args.length) { hashfeelevel = args[argindex]; argindex++; }
    }
    currentby = hashby;
    document.getElementById("by" + currentby).classList.add("selected");
    currtimespan = hashtimespan;
    selectbutton(currtimespan);
    selectCoin(hashconfig, hashfeelevel);
}
