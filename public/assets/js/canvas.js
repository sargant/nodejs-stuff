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
	
	var canvasID = $('#canvas').attr('data-canvas-id');
	
	///////////////////////////////////////////////////////
	// Set up toolbox
	//
	
	$('#color-choice').miniColors();
	
	$("#color-random").change(function() {
		$('#color-choice').miniColors('disabled', $("#color-random").is(':checked'));
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
				image: $('#canvas').getCanvasImage().split(',')[1]
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
		$("#canvas").drawRect({
			fillStyle: '#FFFFFF',
			x: 0,
			y: 0,
			width: $("#canvas").width(),
			height: $("#canvas").height(),
			fromCenter: false
		});
		
		for(var n in strokeHistory) {
			renderStroke(strokeHistory[n]);
		}
		
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
			paint({
				color: stroke.brush.color,
				size: stroke.brush.size,
				x: stroke.coords[i][0],
				y: stroke.coords[i][1],
			});
		}
	};
	
	var paint = function(brush) {
		$("#canvas").drawEllipse({
			fillStyle: brush.color,
			width: brush.size,
			height: brush.size,
			x: brush.x,
			y: brush.y,
			fromCenter: true,
		});
	};
	
	var brushStore = new function() {
	
		var coords = [];
		var brush = null;
		
		var strokeBreak = 10;
		
		this.startStroke = function(b, x, y) {
			brush = b;
			this.moveBrush(x, y);
		};
		
		this.moveBrush = function(x, y) {
			if(!brush) return;
			
			coords.push([x,y]);
			if(coords.length >= strokeBreak) emitStroke(coords.splice(0,strokeBreak));
			
			paint({
				color: brush.color,
				size: brush.size,
				x: x,
				y: y,
			});
		};
		
		this.finishStroke = function() {
			if(!brush) return;
			
			emitStroke(coords);
			brush = null;
			coords.length = 0;
		}
		
		var emitStroke = function(coord_array) {
			socket.emit('transmit_stroke', {'brush': brush, 'coords': coord_array});
		}
	};
	
	$('#canvas').mousedown(function(e) {
	
		if(e.which == 1) {
			var brush = {
				color: ($("#color-random").is(':checked')) ? 
					'#'+(0x1000000+(Math.random())*0xffffff).toString(16).substr(1,6)
					: $('#color-choice').val(),
				size: $('#size-choice').val(),
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
