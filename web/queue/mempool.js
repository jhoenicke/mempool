var charts;
var ranges = [ 0, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 120, 140, 160, 180, 200, 220, 240, 260, 280, 300, 350, 400, 450, 500 ];
var show = [ 0, 1, 2, 3, 4, 5, 6, 7, 9, 11, 12, 13, 16, 17, 18, 21 ];
var reloadInterval = 0;
var reloading;
var colors = [ "#349dac", "#c14540", "#7e5e82", "#84b200", "#a0d0cd",
	       "#c7b52e", "#6cbbea", "#514f4c", "#4e7fbb", "#9f63a0",
	       "#f69445", "#349dac", "#c14540", "#7e5e82", "#84b200",
	       "#a0d0cd"];

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

function zoomReset(from, to) {
    for (var i = 0; i < charts.length; i++) {
	var plot = charts[i];
	var opts = plot.getXAxes()[0].options
	opts.min = from;
	opts.max = to;
	plot.setupGrid();
	plot.draw();
    }
    if (reloadInterval > 0) {
	reloading = setTimeout("window.location.reload();", reloadInterval);
    }
}
function zoomHandler(event, ranges) {
    // clamp the zooming to prevent eternal zoom
    if (ranges.xaxis.to - ranges.xaxis.from < 0.00001)
	ranges.xaxis.to = ranges.xaxis.from + 0.00001;
    for (var i = 0; i < charts.length; i++) {
	var chart = charts[i];
	var opts = chart.getXAxes()[0].options

	clearTimeout(reloading);
	opts.min = ranges.xaxis.from;
	opts.max = ranges.xaxis.to;
        chart.setupGrid();
        chart.draw();
	chart.clearSelection();
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


function showChart(raw, dataidx, container, filename, title, showInLegend, unit) {
    var converted = [];
    var j;
    for (j = 0; j < show.length; j++) {
	var sil = showInLegend;
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
    var feeidx = j;
    converted.push({
	label: "total fee",
	idx: feeidx,
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
    // add zoom out button 
    var from = plot.getXAxes()[0].options.min;
    var to = plot.getXAxes()[0].options.max;
    $('<div class="button" style="right:50px;top:5px">zoom out</div>').appendTo(plot.getPlaceholder()).click(function (e) {
	e.preventDefault();
	zoomReset(from, to);
    });
    return plot;
}


function showMempool(rawdata, reloadival) {
    var chart1 = showChart(rawdata, 1, "chartContainer1", "mempool", "Unconfirmed Transaction Count (Mempool)", false, 1)
    var chart2 = showChart(rawdata, 2, "chartContainer2", "mempoolkb", "Mempool Size in kB", true, 1000.0)
    charts = [chart1, chart2];
    reloadInterval = reloadival;
    if (reloadInterval > 0) {
	reloading = setTimeout("window.location.reload();", reloadInterval);
    }
}
