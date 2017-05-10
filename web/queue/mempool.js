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
var ranges = [ 0, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 120, 140, 160, 180, 200, 220, 240, 260, 280, 300, 350, 400, 450, 500 ];
var show = [ 0, 1, 2, 3, 4, 5, 6, 7, 9, 11, 12, 13, 14, 15, 16, 17, 18, 21 ];
var reloader;
var reloadInterval = 0;
var reloading;
var colors = [ "#349dac", "#c14540", "#7e5e82", "#84b200", "#a0d0cd",
	       "#c7b52e", "#6cbbea", "#514f4c", "#4e7fbb", "#9f63a0",
	       "#f69445", "#349dac", "#c7b52e", "#514f4c", "#c14540",
	       "#7e5e82", "#84b200", "#a0d0cd"];

function legendClick(idx) {
    charts.forEach(function(chart) {
	var data = chart.getData();
	if (idx == show.length) {
	    // fee index
	    chart.getOptions().yaxes[1].show = data[idx].lines.show = !data[idx].lines.show;
	} else {
	    for (var i = 0; i < show.length; i++) {
		data[i].stack = data[i].lines.show = (i >= idx);
	    }
	}
	chart.setData(data);
	chart.setupGrid();
        chart.draw();
    });
}

function tooltip(plot, event, pos, item) {
    var data = plot.getData();
    var series = data[0];
    var xIndex = 0;
    if (item) {
	xIndex = item.dataIndex;
    } else {
	var y = pos.pageY - plot.offset().top;
	var x = pos.pageX - plot.offset().left;
	if (y >= 0 && y < plot.height() &&
	    x >= 0 && x < plot.width()) {
	    for (var j = 0; j < series.data.length; j++) {
		if (series.data[j][0] <= pos.x) {
		    xIndex = j;
		}
	    }
	}
    }
    if (xIndex) {
	var time = series.data[xIndex][0];
	time = $.plot.formatDate($.plot.dateGenerator(time, {timezone: "browser"}), "%b %d, %H:%M");
	var str = "<strong>"+time+"</strong><br/><table>"
	var sum = 0
	for (var i = show.length - 1; i >= 0; i--) {
	    sum = sum + data[i].data[xIndex][1];
	    var value = ranges[show[i]];
	    str = str + "<tr><td>" + (value == 0 ? "total" : value + "+") + 
		":</td><td>" + Math.round(sum).toFixed(0).replace(/(\d)(?=(\d{3})+$)/g, '$1,') + "</td></tr>";
	}
	str = str + "<tr><td>total fee:</td><td>" + data[show.length].data[xIndex][1].toFixed(4) + "</td></tr>";
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

function addData(converted, raw, dataidx, unit) {
    var feeidx = show.length;
    for (i = 0; i < raw.length; i++) {
	for (j = 0; j < show.length; j++) {
	    function get(array, index) {
		if (index >= array.length)
		    return 0;
		else
		    return array[index];
	    }
	    var amount = get(raw[i][dataidx],show[j]) - (j == show.length-1 ? 0 : get(raw[i][dataidx],show[j+1]));
	    converted[j].data.push([raw[i][0]*1000, amount/unit]);
	}
	converted[feeidx].data.push([raw[i][0]*1000, raw[i][3]/1e8]);
    }
    return converted;
}

function convertData(raw, dataidx, unit) {
    var converted = [];
    var j;
    for (j = 0; j < show.length; j++) {
	var name = ranges[show[j]];
	var legend = 
	    j == show.length-1 ? (name+"+") :
	    name+"-"+ranges[show[j+1]];
	var color = colors[j];
	converted.push({
	    color: color,
	    label: legend,
	    idx: j,
	    data: [],
	});
    }
    converted.push({
	label: "total fee",
	idx: show.length,
	yaxis: 2,
	color: "#000",
	stack: false,
	lines: {
	    show: false,
	    fill: false,
	    steps: false
	},
	data: [],
    });
    return addData(converted, raw, dataidx, unit);
}

function showChart(raw, dataidx, container, filename, title, unit) {
    var converted = convertData(raw, dataidx, unit);
    var config = {
	series: {
	    stack: 1,
	    lines: {
		show: true,
		fill: 0.66,
		steps: false
	    },
	},
	selection: { mode: "x" },
	xaxis: { mode: "time", timezone: "browser" },
	yaxes: [ {}, { show: false, position: "right", min: 0}],
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
    var plot = $.plot("#"+container, converted, config);
    plot.hooks.drawOverlay.push( function(plot, cvs) {
	drawTitle(plot, cvs, title);
    });
    $(plot.getPlaceholder()).bind("plothover", function (event, pos, item) {
	tooltip(plot, event, pos, item);
    });
    $(plot.getPlaceholder()).bind("plotselected", zoomHandler);
    return plot;
}


function showMempool(rawdata) {
    var chart1 = showChart(rawdata, 1, "chartContainer1", "mempool", "Unconfirmed Transaction Count (Mempool)", 1)
    var chart2 = showChart(rawdata, 2, "chartContainer2", "mempoolkb", "Mempool Size in kB", 1000.0)
    charts = [chart1, chart2];
    reloadInterval = 60000;
    reloader = update;
    if (reloadInterval > 0) {
	reloading = setTimeout(reloader, reloadInterval);
    }
}

function zoomData(rawdata) {
    charts[0].setData(convertData(rawdata, 1, 1))
    charts[1].setData(convertData(rawdata, 2, 1000.0))
    for (var i = 0; i < 2; i++) {
	var chart = charts[i];
	chart.setupGrid();
        chart.draw();
    }
}

function loadData(rawdata) {
    if (!charts) {
	showMempool(rawdata);
    } else {
	charts[0].setData(convertData(rawdata, 1, 1))
	charts[1].setData(convertData(rawdata, 2, 1000.0))
	for (var i = 0; i < 2; i++) {
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

var periods = ["2h", "8h", "24h", "2d", "4d", "1w", "2w", "30d", "3m", "all"];
function selectbutton(timespan) {
    for (i = 0; i < periods.length; i++) {
	if (periods[i] == timespan) {
	    $("#lk"+periods[i]).addClass("selected");
	} else {
	    $("#lk"+periods[i]).removeClass("selected");
	}
    }
}

function loadRange(from, to, func) {
    var increment = Math.floor((to - from) / 60000000);
    if (increment < 1) {
	increment = 1;
    }
    $.ajax({
	url: "db.php",
	data: { s: Math.floor(from/1000),
		e: Math.floor(to/1000),
		i: increment },
	dataType: "jsonp",
	jsonpCallback: "call",
	jsonp: false,
    }).done(func);
}

function update() {
    loadRange(charts[0].getAxes().xaxis.max+1000, Date.now()+600000, function(rawdata) {
	charts[0].setData(addData(charts[0].getData(), rawdata, 1, 1))
	charts[1].setData(addData(charts[1].getData(), rawdata, 2, 1000.0))
	for (var i = 0; i < 2; i++) {
	    charts[i].setupGrid();
            charts[i].draw();
	}
	reloading = setTimeout(reloader, reloadInterval);
    });
}

function button(timespan) {
    location.hash = "#" + timespan;
    $.ajax({
	url: timespan+".js",
	data: "",
	dataType: "jsonp",
	jsonpCallback: "call",
	jsonp: false,
    }).done(loadData);
    selectbutton(timespan);
}

function main() {
    var timespan = location.hash;
    if (timespan.length == 0) {
	timespan = "24h";
    } else {
	timespan = timespan.substring(1);
    }
    var div = $("#periods");
    var onclickfun = function(e) { button(e.target.text); };
    for (i = 0; i < periods.length; i++) {
	var name = periods[i];
	var btn = document.createElement("a");
	btn.text = name;
	btn.href = "#"+name;
	btn.onclick = onclickfun;
	btn.className = "lnk";
	btn.id = "lk"+name;
	div.append(btn);
    }
    button(timespan);
}
