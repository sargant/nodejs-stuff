$(document).ready(function() {

	///////////////////////////////////////////////////////
	// Test that browser is capable of 2D canvases
	//
	
	function cs(){
		var e = document.createElement('canvas');
		return !!(e.getContext && e.getContext('2d'));
	}

	if(!cs()) {
		$("#canvas-unsupported").show();
		return;
	}
	
	var canvas = $('#canvas').get(0);
	var canvasCtx = canvas.getContext("2d");
	var canvasID = $('#canvas').attr('data-canvas-id');
	
	var brushPreview = $('#brush-preview').get(0);
	var brushPreviewCtx = brushPreview.getContext("2d");
	
	///////////////////////////////////////////////////////
	// Set up toolbox
	//
	
	function updateBrushPreview() {
	
		brushPreviewCtx.fillStyle = "#FFFFFF";
		brushPreviewCtx.fillRect(0, 0, canvas.width, canvas.height);
		
		paint(brushPreviewCtx, {
			x: brushPreview.width / 2.0,
			y: brushPreview.height / 2.0,
			color: $('#color-choice').val(),
			size: $('#size-choice').val(),
			type: $('#brush-type').val(),
		});
	};
	
	$('#color-choice').miniColors({'change': updateBrushPreview});
	$('.brush-control').change(updateBrushPreview);
	
	updateBrushPreview();
	
	$("#color-random").click(function(event) {
		$('#color-choice').miniColors('value', '#' + Math.floor(Math.random() * 16777215).toString(16));
		event.preventDefault();
	});
	
	$('#share-to-imgur').click(function(event) {
	
		event.preventDefault();
		
		var label = $('#share-to-imgur-label');
		var previousLabel = label.text();
		label.text("Uploading...");
		
		$('#share-to-imgur-link').hide().removeClass('btn-danger').removeClass('btn-success');
		
		$.ajax({
			url: 'http://api.imgur.com/2/upload.json',
			type: 'POST',
			dataType: 'json',
			data: {
				type: 'base64',
				key: '8ba822fb5788eca3d187b5505c2cce72',
				image: canvas.toDataURL().split(',')[1]
			}
		}).success(function(data) {
			$('#share-to-imgur-link').addClass('btn-success')
				.text("Open")
				.attr("href", data['upload']['links']['imgur_page'])
				.show();
			label.text(previousLabel);
			
		}).error(function() {
			$('#share-to-imgur-link').addClass('btn-danger').text("Error").show();
			label.text(previousLabel);
		});
	});
	
	///////////////////////////////////////////////////////
	// Set up sockets
	//
	
	var socket = io.connect('/canvas');
	var disconnectTimer;
	
	socket.on('connect', function(data) {
		clearTimeout(disconnectTimer);
		$("#server-link-lost").slideUp();
		socket.emit("canvas_join", canvasID);
	});
	
	socket.on('disconnect', function(data) {
		disconnectTimer = setTimeout(function() {
			$("#server-link-lost").slideDown();
		}, 5000);
	});
	
	socket.on('client_count', function(count) {
	
		var oc = $("#online-count");
		
		if(typeof this.prev == "undefined") this.prev = count;
		if(typeof this.orig == "undefined") this.orig = oc.css('color');
		
		oc.text(count + (count == 1 ? " person" : " people") + " on this canvas");
		
		var color = (count > this.prev? "#090" : (count < this.prev ? "#C00" : this.orig));
		
		$("#online-count").css('color', color).animate({'color': this.orig}, 2000);
		this.prev = count;
	});
	
	socket.on('receive_stroke', function(stroke) { renderStroke(stroke) });
	
	socket.on('history', function(strokeHistory) {
	
		// Reset the canvas with a big white rectangle
		canvasCtx.fillStyle = "#FFFFFF";
		canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
		
		for(var n in strokeHistory) renderStroke(strokeHistory[n]);
		
		$("#canvas").removeClass("loading");
	});
	
	socket.on('canvas_ttl', function(percentage) {
	
		$('#canvas-clear-progress').css({width: percentage * 100 + "%"});
		
		$('#canvas-clear-progress-style')
			.toggleClass('progress-info', (percentage < 0.8))
			.toggleClass('progress-warning', (percentage >= 0.8 && percentage < 0.95))
			.toggleClass('progress-danger', (percentage >= 0.95));
	});
	
	socket.on('chat_received', function(chat) { 
		addChatMessage(chat.user, chat.message, false);
	});
	
	///////////////////////////////////////////////////////
	// Set up canvas interaction
	//
	
	var renderStroke = function(stroke) {
		for(var i = 0; i < stroke.coords.length; i++) {
			paint(canvasCtx, {
				color: stroke.brush.color,
				size: stroke.brush.size,
				type: stroke.brush.type,
				x: stroke.coords[i][0],
				y: stroke.coords[i][1],
			});
		}
	};
	
	function paint(ctx, brush) {
		
		ctx.save();
		ctx.beginPath();
		
		switch(brush.type) {
			
			case "filled-square":
				ctx.strokeWidth = 0;
				ctx.fillStyle = brush.color;
				ctx.rect(brush.x - brush.size / 2.0, brush.y - brush.size / 2.0, brush.size, brush.size);
				break;
				
			default:
				ctx.strokeWidth = 0;
				ctx.fillStyle = brush.color;
				ctx.arc(brush.x, brush.y, brush.size / 2.0, 0, 2.0 * Math.PI, true);
				break;
		}
		
		ctx.stroke();
		ctx.fill();
		
		ctx.restore();
	};
	
	var brushStore = new function() {
	
		var coords = [];
		var cachedCoords = [];
		
		var brush = null;
		
		var strokeBreak = 10;
		
		this.startStroke = function(b, x, y) {
			brush = b;
			this.moveBrush(x, y);
		};
		
		this.moveBrush = function(x, y) {
			if(!brush) return;
			
			coords.push([x,y]);
			cachedCoords.push([x,y]);
			
			if(cachedCoords.length >= strokeBreak) emitStroke(coords.splice(0,strokeBreak));
			
			paint(canvasCtx, {
				color: brush.color,
				size: brush.size,
				type: brush.type,
				x: x,
				y: y,
			});
		};
		
		this.finishStroke = function() {
			if(!brush) return;
			
			emitStroke(cachedCoords);
			brush = null;
			coords.length = 0;
			cachedCoords.length = 0;
		}
		
		var emitStroke = function(coord_array) {
			socket.emit('transmit_stroke', {'brush': brush, 'coords': coord_array});
		}
	};
	
	$('#canvas').mousedown(function(e) {
	
		if(e.which == 1) {
			var brush = {
				color: $('#color-choice').val(),
				size: $('#size-choice').val(),
				type: $('#brush-type').val(),
			}
			
			brushStore.startStroke(brush, e.pageX - this.offsetLeft, e.pageY - this.offsetTop);
		}
		
		e.preventDefault();
		return false;
	});
	
	$('#canvas').mousemove(function(e) {
		brushStore.moveBrush(e.pageX - this.offsetLeft, e.pageY - this.offsetTop);
	});
	
	$(document).mouseup(function() {
		brushStore.finishStroke();
	});
	
	///////////////////////////////////////////////////////
	// Chatbox
	//
	
	$('#chat-input-form').submit(function(e) {
		e.preventDefault();
		socket.emit('chat_sent', $('#chat-input').val());
		$('#chat-input').val("");
	});
});

function addChatMessage(user, message, self) {

	var self = (self === true);
	
	$('#chat-history').append(
		$('<div/>').addClass("chat-message").append(
			$('<a>').addClass("author")
				.toggleClass("author-me", self)
				.text("@"+user)
				.prop("href", "http://twitter.com/"+user)
		).append(message)
	);
	
	$("#chat-history").animate({ scrollTop: $("#chat-history").prop("scrollHeight") });
};
