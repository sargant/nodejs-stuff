
// Some namespaced helper functions that do not require the page to be loaded
var canvasUtils = {
	
	isCanvasSupported: function () {
		var e = document.createElement('canvas')
		return !!(e.getContext && e.getContext('2d'))
	},
	
	hex2rgba: function (hexString, alpha) {
		
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
}

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
		previewCanvas.context.clearRect(0, 0, canvas.width, canvas.height)
		
		// Draw the brush in the center of the canvas
		paint(previewCanvas.context, {
			color:  $('#color-choice').val(),
			size:   $('#brush-size-slider').slider("option", "value"),
			type:   $('#brush-type').val(),
			coords: [previewCanvas.element.width / 2.0, previewCanvas.element.height / 2.0]
		})
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
	
	socket.on('receive_stroke', function (stroke) { renderStroke(stroke) })
	
	socket.on('stroke_history', function (strokeHistory) {
		// Reset the canvas with a big white rectangle
		mainCanvas.context.fillStyle = "#FFFFFF"
		mainCanvas.context.fillRect(0, 0, mainCanvas.element.width, mainCanvas.element.height)
		
		for(var n in strokeHistory) renderStroke(strokeHistory[n])
		$("#canvas").removeClass("loading")
	})
	
	socket.on('chat_history', function (chatHistory) {
		for(var n in chatHistory)
			addChatMessage(chatHistory[n].user, chatHistory[n].message, chatHistory[n].time, false)
	})
	
	socket.on('canvas_ttl', function (percentage) {
		$('#canvas-clear-progress').css({width: percentage * 100 + "%"})
		$('#canvas-clear-progress-style')
			.toggleClass('progress-info', (percentage < 0.8))
			.toggleClass('progress-warning', (percentage >= 0.8 && percentage < 0.95))
			.toggleClass('progress-danger', (percentage >= 0.95))
	})
	
	socket.on('chat_received', function (chat) { 
		addChatMessage(chat.user, chat.message, chat.time, false)
	})
	
	///////////////////////////////////////////////////////
	// Set up canvas interaction
	//
	
	var renderStroke = function(stroke) {
		for(var i = 0; i < stroke.coords.length; i++)
			paint(mainCanvas.context, {
				color: stroke.brush.color,
				size: stroke.brush.size,
				type: stroke.brush.type,
				coords: stroke.coords[i],
			})
	}
	
	function paint(ctx, brush) {
		
		ctx.save()
		ctx.beginPath()
		ctx.lineCap = "round"
		ctx.lineJoin = "round"
		
		switch(brush.coords.length) {
			case 4: brush.coords[4] = 1.0
			case 5:
				ctx.lineWidth = 1
				ctx.strokeStyle = canvasUtils.hex2rgba(brush.color, brush.coords[4])
				ctx.fillStyle = "transparent"
				ctx.moveTo(brush.coords[0], brush.coords[1])
				ctx.lineTo(brush.coords[2], brush.coords[3])
				break
			case 2: brush.coords[2] = 1.0
			case 3:
				ctx.lineWidth = 0
				ctx.strokeStyle = "transparent"
				ctx.fillStyle = canvasUtils.hex2rgba(brush.color, brush.coords[2])
				ctx.arc(brush.coords[0], brush.coords[1], brush.size / 2.0, 0, 2.0 * Math.PI, true)
				break
			default:
				console.error("Invalid co-ordinate data received")
				break
		}
			
		ctx.stroke()
		ctx.fill()
		ctx.restore()
	}
	
	var brushStore = new function() {
	
		var coords      = []
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
			if(!brush) return
			
			coords.push([x,y])
			
			var paintObject = {
				color: brush.color,
				size: brush.size,
				type: brush.type,
			}
			
			switch(brush.type) {
					
				case "airbrush":
				case "paint":
					var c = [x, y, (brush.type == "paint") ? 1.0 : 0.1]
					strokeCache.push(c)
					paintObject.coords = c
					paint(mainCanvas.context, paintObject)
					strokeCount += 1
					break
				
				case "pencil":
					if(coords.length < 2) break
					var c = [coords[coords.length-2][0], coords[coords.length-2][1], x, y]
					strokeCache.push(c)
					paintObject.coords = c
					paint(mainCanvas.context, paintObject)
					strokeCount += 1
					break
					
				// case "stringed-pencil":
					// var maxHistory = Math.min(20, coords.length);
					
					// for(var i = 2; i < maxHistory; i++) {
						// var c = [coords[coords.length - i][0], coords[coords.length - i][1], x, y, (i==2) ? 1 : 0.1];
						// strokeCache.push(c);
						// paintObject.coords = c;
						// paint(canvasCtx, paintObject);
					// }
					// strokeCount += 1;
					// break;
				
				// case "magnetic-pencil":
					// for(var i = 2; i < coords.length; i++) {
						// var sep = (coords[coords.length - i][0] - x) * (coords[coords.length - i][0] - x)
							// + (coords[coords.length - i][1] - y) * (coords[coords.length - i][1] - y);
						
						// if(sep > 2500) continue;
						
						// var c = [coords[coords.length - i][0], coords[coords.length - i][1], x, y, (i==2) ? 1 : 0.25 * (1 - (sep/2500))];
						// strokeCache.push(c);
						// paintObject.coords = c;
						// paint(canvasCtx, paintObject);
					// }
					// strokeCount += 1;
					// break;
				
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
				
				default:
					console.error("Unimplemented brush")
					break
			}
			
			if(strokeCount >= strokeBreak) {
				emitStroke(strokeCache.splice(0, strokeCache.length))
				strokeCount = 0
			}
		}
		
		this.finishStroke = function() {
			if(!brush) return
			if(strokeCache.length > 0) emitStroke(strokeCache)
			
			brush = null
			coords = []
			coords.length = 0
			strokeCache = []
			strokeCache.length = 0
		}
	}
	
	$('#canvas').mousedown(function(e) {
	
		event.preventDefault()
		if(e.which != 1) return false
		if($("#canvas").hasClass("loading")) return false
		
		var brush = {
			color: $('#color-choice').val(),
			size: $('#brush-size-slider').slider("option", "value"),
			type: $('#brush-type').val(),
		}
		
		brushStore.startStroke(brush, e.pageX - this.offsetLeft, e.pageY - this.offsetTop)
		return false
	})
	
	$(document).mouseup(function() { brushStore.finishStroke() })
	
	$('#canvas').mousemove(function(e) { 
		brushStore.moveBrush(e.pageX - this.offsetLeft, e.pageY - this.offsetTop) 
	})
	
	///////////////////////////////////////////////////////
	// Chatbox
	//
	
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
