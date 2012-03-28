
// Some namespaced helper functions that do not require the page to be loaded
var canvasUtils = new function () {

	// Use MurmurHash32 as a source of low-quality, reproducible pseudorandom numbers
	//
	// Copyright (c) 2011 Gary Court
	//
	// Permission is hereby granted, free of charge, to any person obtaining a copy of this
	// software and associated documentation files (the "Software"), to deal in the Software
	// without restriction, including without limitation the rights to use, copy, modify, merge,
	// publish, distribute, sublicense, and/or sell copies of the Software, and to permit
	// persons to whom the Software is furnished to do so, subject to the following conditions:
	//
	// The above copyright notice and this permission notice shall be included in all copies
	// or substantial portions of the Software.
	var murmurhash2_32_gc = function(str, seed) {
		var l = str.length, h = seed ^ l, i = 0, k
		while (l >= 4) {
			k = ((str.charCodeAt(i)&0xff))|((str.charCodeAt(++i)&0xff)<<8)|((str.charCodeAt(++i)&0xff)<<16)|((str.charCodeAt(++i)&0xff)<<24)
			k = (((k&0xffff)*0x5bd1e995)+((((k>>>16)*0x5bd1e995)&0xffff)<<16))
			k ^= k>>>24
			k = (((k&0xffff)*0x5bd1e995)+((((k>>>16)*0x5bd1e995)&0xffff)<<16))
			h = (((h&0xffff)*0x5bd1e995)+((((h>>>16)*0x5bd1e995)&0xffff)<<16))^k
			l -= 4
			++i
		}
		switch (l) {
			case 3: h ^= (str.charCodeAt(i+2)&0xff)<<16
			case 2: h ^= (str.charCodeAt(i+1)&0xff)<< 8
			case 1: h ^= (str.charCodeAt(i)&0xff)
				h = (((h&0xffff)*0x5bd1e995)+((((h>>>16)*0x5bd1e995)&0xffff)<<16))
		}
		h ^= h>>>13
		h = (((h&0xffff)*0x5bd1e995)+((((h>>>16)*0x5bd1e995)&0xffff)<<16))
		h ^= h>>>15
		return h>>>0
	}
	
	this.poorRandom = function (string) {
		return parseInt(murmurhash2_32_gc(string).toString().substr(-6)) / 1000000
	}
	
	this.isCanvasSupported = function () {
		var e = document.createElement('canvas')
		return !!(e.getContext && e.getContext('2d'))
	}
	
	this.hex2rgba = function (hexString, alpha) {
		
		if(false === hexString.match(/^#[0-9A-Fa-f]{6}$/)) return false
		
		var values = []
		for(var i = 1; i <= 5; i += 2)
			values.push(parseInt(hexString.substr(i,2), 16))
		
		return (
			(alpha === undefined || alpha === null) 
			? "rgb(" + values.join() + ")"
			: "rgba(" + values.concat(alpha).join() + ")"
		)
	}
	
	var paintCoordLog = {}
	this.clearPaintLog = function () { paintCoordLog = {} }
	
	var addPaintLog = function (b, point) {
		if(paintCoordLog[b] === undefined) paintCoordLog[b] = []
		paintCoordLog[b].push(point)
	}
	
	this.paint = function (ctx, brush, coords) {
		
		// Check it's a valid brush and drop out immediately if not
		var currentBrushSpec = BRUSH_SPECS.brushes[brush.type]
		if(currentBrushSpec === undefined) return false
		
		// Prepare for drawing with some initializations
		ctx.save()
		ctx.beginPath()
		ctx.lineCap = "round"
		ctx.lineJoin = "round"
		
		switch(brush.type) {
			
			// The circular primitives
			case "paint":
			case "airbrush":
			
				if(coords.length === 2) coords[2] = 1.0
				if (coords.length !== 3) {
					console.error("Invalid coordinate data received")
					break
				}
				
				ctx.lineWidth = 0
				ctx.strokeStyle = "transparent"
				ctx.fillStyle = canvasUtils.hex2rgba(brush.color, coords[2])
				ctx.arc(coords[0], coords[1], brush.size / 2.0, 0, 2.0 * Math.PI, true)
				addPaintLog(brush.type, [coords[0], coords[1]])
				break
			
			// The pencils
			case "pencil":
			
				if(coords.length === 4) coords[4] = 1.0
				if(coords.length !== 5) {
					console.error("Invalid coordinate data received")
					break
				}
				
				ctx.lineWidth = 1
				ctx.strokeStyle = canvasUtils.hex2rgba(brush.color, coords[4])
				ctx.fillStyle = "transparent"
				ctx.moveTo(coords[0], coords[1])
				ctx.lineTo(coords[2], coords[3])
				addPaintLog(brush.type, [coords[0], coords[1]])
				break
			
			case "pencil-calligraphic":
			
				if(coords === "break") {
					addPaintLog(brush.type, "break")
					break
				}
				
				if(coords.length === 4) coords[4] = 1.0
				if(coords.length !== 5) {
					console.error("Invalid coordinate data received")
					break
				}
				
				ctx.lineWidth = 1
				ctx.strokeStyle = canvasUtils.hex2rgba(brush.color, coords[4])
				ctx.fillStyle = "transparent"
				ctx.moveTo(coords[0], coords[1])
				ctx.lineTo(coords[2], coords[3])
				
				var history = paintCoordLog[brush.type]
				var maxHistory = (history === undefined) ? 0 : Math.min(20, history.length)
				
				for(var i = 1; i <= maxHistory; i++) {
					if(history[history.length-i] == "break") break
					var a = history[history.length-i][0]
					var b = history[history.length-i][1]
					// Limit distance to prevent vast inky swathes
					if(((coords[2]-a) * (coords[2]-a) + (coords[2]-a) * (coords[2]-a)) < 10000) {
						ctx.moveTo(history[history.length-i][0], history[history.length-i][1])
						ctx.lineTo(coords[2], coords[3])
					}
				}
				
				addPaintLog(brush.type, [coords[0], coords[1]])
				break
			
			case "pencil-magnetic":
			
				if(coords.length === 4) coords[4] = 1.0
				if(coords.length !== 5) {
					console.error("Invalid coordinate data received")
					break
				}
				
				ctx.lineWidth = 1
				ctx.strokeStyle = canvasUtils.hex2rgba(brush.color, coords[4])
				ctx.fillStyle = "transparent"
				ctx.moveTo(coords[0], coords[1])
				ctx.lineTo(coords[2], coords[3])
				
				ctx.stroke()
				ctx.strokeStyle = canvasUtils.hex2rgba(brush.color, coords[4])
				
				var history = paintCoordLog[brush.type]
				
				if(history !== undefined) {
					for(var i = 1; i <= history.length; i++) {
						var a = history[history.length-i][0]
						var b = history[history.length-i][1]
						var sep = ((coords[2]-a) * (coords[2]-a)) + ((coords[3]-b) * (coords[3]-b))
						if(sep < 1000) {
							ctx.strokeStyle = canvasUtils.hex2rgba(brush.color, 0.1 * (1 - (sep/1000)))
							ctx.beginPath()
							ctx.moveTo(a,b)
							ctx.lineTo(coords[2],coords[3])
							ctx.stroke()
						}
					}
				}
				
				addPaintLog(brush.type, [coords[0], coords[1]])
				break
			
			default:
				console.error("Unrecognized brush stroke received")
				break
		}
		
		// Complete the stroke and restore previous settings
		ctx.stroke()
		ctx.fill()
		ctx.restore()
	}
}

////////////////////////////////////////////////////////////////////////////////
// Now begins the jQuery section for things that are dependent on the DOM
////////////////////////////////////////////////////////////////////////////////

$(function () {

	// Quit immediately if canvas is not supported
	if(false === canvasUtils.isCanvasSupported()) {
		$("#canvas-unsupported").show()
		return
	}
	
	// Load handles for the main canvas and preview canvas
	var mainCanvas = {
		element: $('#canvas').get(0),
		context: $('#canvas').get(0).getContext('2d'),
		id:      $('#canvas').attr('data-canvas-id')
	}
	
	var previewCanvas = {
		element: $('#brush-preview').get(0),
		context: $('#brush-preview').get(0).getContext('2d')
	}
	
	////////////////////////////////////////////////////////////////////////////
	// Toolbox event handling and initializers
	////////////////////////////////////////////////////////////////////////////
	
	var previewCanvasRefresh = function () {
	
		// Clear the canvas
		previewCanvas.context.clearRect(0, 0, previewCanvas.element.width, previewCanvas.element.height)
		
		// Do not draw unless primitive
		var currentBrushSpec = BRUSH_SPECS.brushes[$('#brush-type').val()]
		if(currentBrushSpec.kind !== "primitive")
			return
		
		// Draw the brush in the center of the canvas
		canvasUtils.paint(previewCanvas.context, {
			color:  $('#color-choice').val(),
			size:   $('#brush-size-slider').slider("option", "value"),
			type:   $('#brush-type').val(),
		}, [previewCanvas.element.width / 2.0, previewCanvas.element.height / 2.0])
	}
	
	// Build jQuery controls
	$('#brush-size-slider').slider({ min: 3, max: 50, value: 10,range: 'min'})
	
	// Bind all relevant events to the brush preview refresher
	previewCanvasRefresh()
	$('#color-choice').miniColors({ 'change': previewCanvasRefresh })
	$('#brush-size-slider').bind("slide", function () { previewCanvasRefresh() })
	$('.brush-control').change(function () { previewCanvasRefresh() })
	
	// Show and hide some extra controls depending on brush choice
	var showHideCircularControls = function () {
		switch ($('#brush-type').val()) {
			case "paint":
			case "airbrush":
				$('#filled-circle-controls').slideDown('fast')
				break
			default:
				$('#filled-circle-controls').slideUp('fast')
				break
		}
	}
	$('#brush-type').change(showHideCircularControls).keypress(showHideCircularControls)
	
	// Bind an action to the "random color" button
	$("#color-random").click(function (event) {
		event.preventDefault()
		$('#color-choice').miniColors('value', '#' + Math.floor(Math.random() * 16777215).toString(16))
	})
	
	// Bind an action to the "share to imgur" button
	$('#share-to-imgur').click(function (event) {
	
		event.preventDefault()
		
		var label = $('#share-to-imgur-label')
		var previousLabel = label.text()
		label.text("Uploading...")
		
		$('#share-to-imgur-link')
			.hide()
			.removeClass('btn-danger')
			.removeClass('btn-success')
		
		$.ajax({
			url: 'http://api.imgur.com/2/upload.json',
			type: 'POST',
			dataType: 'json',
			data: {
				type: 'base64',
				key: '8ba822fb5788eca3d187b5505c2cce72',
				image: canvas.toDataURL().split(',')[1]
			}
		}).success(function (data) {
			label.text(previousLabel)
			$('#share-to-imgur-link')
				.addClass('btn-success')
				.text("Open")
				.attr("href", data['upload']['links']['original'])
				.show()
			
		}).error(function () {
			label.text(previousLabel)
			$('#share-to-imgur-link')
				.addClass('btn-danger')
				.text("Error")
				.attr("href", "#")
				.show()
		})
	})
	
	////////////////////////////////////////////////////////////////////////////
	// Socket communication event handlers and initialization
	////////////////////////////////////////////////////////////////////////////
	
	var socket = io.connect('/canvas')
	
	socket.on('connect', function (data) {
		$("#server-link-lost").stop(true).slideUp()
		socket.emit("canvas_join", mainCanvas.id)
	})	
	socket.on('disconnect', function(data) {
		$("#server-link-lost").delay(5000).slideDown()
	})
	
	socket.on('client_count', function (count) {
	
		var oc = $("#online-count")
		if(this.prev === undefined) this.prev = count
		if(this.orig === undefined) this.orig = oc.css('color')
		
		oc.text(count + (count == 1 ? " person" : " people") + " on this canvas")
		
		var color = this.orig
		if (count > this.prev) color = "#090"
		if (count < this.prev) color = "#C00"
		this.prev = count
		
		$("#online-count")
			.css('color', color)
			.animate({'color': this.orig}, {duration: 2000, queue: false})
	})
	
	socket.on('canvas_ttl', function (percentage) {
		$('#canvas-clear-progress').css({width: percentage * 100 + "%"})
		$('#canvas-clear-progress-style')
			.toggleClass('progress-info', (percentage < 0.8))
			.toggleClass('progress-warning', (percentage >= 0.8 && percentage < 0.95))
			.toggleClass('progress-danger', (percentage >= 0.95))
	})
	
	socket.on('stroke_history', function (strokeHistory) {
		// Reset the canvas with a big white rectangle
		mainCanvas.context.fillStyle = "#FFFFFF"
		mainCanvas.context.fillRect(0, 0, mainCanvas.element.width, mainCanvas.element.height)
		
		canvasUtils.clearPaintLog()
		
		var strokeHistoryLength = strokeHistory.length
		var strokeHistoryProgression = 1
		
		var process = function () {
			if(strokeHistory.length > 0) {
				var stroke = strokeHistory.shift()
				renderStroke(stroke)
				strokeHistoryProgression += 1
				var barWidth = parseInt(100 * (strokeHistoryProgression / strokeHistoryLength)) + '%'
				$('#canvas-loading-bar-width').css('width', barWidth)
				setTimeout(process, 0)
			} else {
				$("#canvas-loading").hide()
			}
		}
		
		process()
	})
	
	socket.on('receive_stroke', function (stroke) { renderStroke(stroke) })
	
	socket.on('chat_history', function (chatHistory) {
		for(var n in chatHistory)
			addChatMessage(chatHistory[n].user, chatHistory[n].message, chatHistory[n].time, false)
	})
	
	socket.on('chat_received', function (chat) { 
		addChatMessage(chat.user, chat.message, chat.time, false)
	})
	
	///////////////////////////////////////////////////////
	// Set up canvas interaction
	//
	
	$('#canvas').after(
		$('<div>')
			.attr("id", "canvas-loading")
			.css({
				top: mainCanvas.element.offsetTop,
				left: mainCanvas.element.offsetLeft,
				height: mainCanvas.element.offsetHeight,
				width: mainCanvas.element.offsetWidth,
			}).append(
				$('<div>')
					.append('<h3>Rendering history...</h3>')
					.append('<div id="canvas-loading-bar" class="progress progress-striped active"><div class="bar" id="canvas-loading-bar-width"></div></div>')
			)
	)
	
	var renderStroke = function(stroke) {
		for(var i = 0; i < stroke.coords.length; i++)
			canvasUtils.paint(mainCanvas.context, stroke.brush, stroke.coords[i])
	}
	
	var brushInterpreter = new function() {
	
		var previousPoint = []
		var strokeCache = []
		var brush       = null
		var strokeCount = 0
		var strokeBreak = 20
		
		var emitStroke = function(coord_array) {
			var transmit = {'brush': brush, 'coords': coord_array}
			socket.emit('transmit_stroke', transmit)
		}
		
		this.startStroke = function(b, x, y) {
			brush = b
			this.moveBrush(x, y)
		}
		
		this.moveBrush = function(x, y) {
			
			if(!brush) return false
			
			var currentBrushSpec = BRUSH_SPECS.brushes[brush.type]
			if(currentBrushSpec === undefined) return false
			
			// For now, just pass off
			nextInterpolatedPoint(x,y,currentBrushSpec)
		}
		
		var nextInterpolatedPoint = function (x, y, currentBrushSpec) {
			
			switch(currentBrushSpec.kind) {
				
				// Primitive types
				case "primitive":
					var c = [x, y]
					if(brush.type == "airbrush") c.push(0.1)
					strokeCache.push(c)
					canvasUtils.paint(mainCanvas.context, brush, c)
					strokeCount += 1
					break
				
				// Line types
				case "line":
					if(previousPoint.length == 2) {
						var c = [previousPoint[0], previousPoint[1], x, y]
						strokeCache.push(c)
						canvasUtils.paint(mainCanvas.context, brush, c)
						strokeCount += 1
					}
					previousPoint = [x,y]
					break
					
				default:
					console.error("Unimplemented brush")
					break
			}
			
			if(strokeCount >= strokeBreak) {
				emitStroke(strokeCache.splice(0, strokeCache.length))
				strokeCount = 0
			}
		}
		
		this.finishStroke = function(retainMousedown) {
			
			if(!brush) return
			
			var currentBrushSpec = BRUSH_SPECS.brushes[brush.type]
			
			if(currentBrushSpec !== undefined && currentBrushSpec.breakOnMouseUp === true) {
				strokeCache.push("break")
				canvasUtils.paint(mainCanvas.context, brush, "break")
			}
			
			if(strokeCache.length > 0) emitStroke(strokeCache)
			previousPoint = []
			previousPoint.length = 0
			strokeCache = []
			strokeCache.length = 0
			
			if(retainMousedown !== true) brush = null
		}
	}
	
	/////////////////////////////////////////
	// Record mouse interactions with canvas
	
	// On mousedown, store the current brush and keep it untilwe mouseup
	$('#canvas').mousedown(function(e) {
	
		e.preventDefault()
		// Left mouse button only
		if(e.which != 1) return false
		// Wait for the loading screen to disappear
		if($("#canvas").hasClass("loading")) return false
		
		// Ensure we've pushed all details from any previous strokes
		brushInterpreter.finishStroke()
		
		// Set the brush properties
		var brush = {
			color: $('#color-choice').val(),
			size: $('#brush-size-slider').slider("option", "value"),
			type: $('#brush-type').val(),
		}
		
		// Notify the brush interpreter of the brush type and stroke starting position
		brushInterpreter.startStroke(brush, e.pageX - this.offsetLeft, e.pageY - this.offsetTop)
		return false
	})
	
	// Finalize the stroke and push any remaining stroke objects to the server
	$(document).mouseup(function() { brushInterpreter.finishStroke() })
	// Clear the stroke log, but do not lift the mouse off the canvas
	$('#canvas').mouseleave(function () { brushInterpreter.finishStroke(true) })
	// Send the interpreter a new location in the chain
	$('#canvas').mousemove(function(e) { 
		brushInterpreter.moveBrush(e.pageX - this.offsetLeft, e.pageY - this.offsetTop) 
	})
	
	////////////////////////////////////////////////////////////////////////////
	// Chatbox interactions
	////////////////////////////////////////////////////////////////////////////
	
	$('#chat-input-form').submit(function(e) {
		e.preventDefault()
		socket.emit('chat_sent', $('#chat-input').val())
		$('#chat-input').val("")
	})
	
	var addChatMessage = function (user, message, time, self) {
	
		var self = !!self
		var t = new Date(time)
	
		$('#chat-history').append(
			$('<div>').addClass("chat-message").append(
				$('<span>').addClass("timestamp")
					.text(t.getHours() + ":" + t.getMinutes())
			).append(
				$('<a>').addClass("author")
					.toggleClass("author-me", self)
					.text("@"+user)
					.prop("href", "http://twitter.com/"+user)
			).append(document.createTextNode(message))
		)
	
		$("#chat-history").animate({ scrollTop: $("#chat-history").prop("scrollHeight") }, {queue: false})
	}
})

// case "cobweb-pencil":
	// for(var i = 2; i < coords.length; i++) {
		// var sep = (coords[coords.length - i][0] - x) * (coords[coords.length - i][0] - x)
			// + (coords[coords.length - i][1] - y) * (coords[coords.length - i][1] - y);
		
		// if(sep > 5000) continue;
		// if(i > 2 && Math.random() > 0.2) continue;
		
		// var c = [coords[coords.length - i][0], coords[coords.length - i][1], x, y, (i==2) ? 1 : 0.25];
		// strokeCache.push(c);
		// paintObject.coords = c;
		// paint(canvasCtx, paintObject);
	// }
	// strokeCount += 1;
	// break;
