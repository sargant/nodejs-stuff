// Set some globally accessible properties
var properties = {
	namespace: 'canvas',
	public_canvas: 'public_canvas',
}

// Internal variables
var canvasLifetime = 900000;   // Delete canvases after 15 minutes
var cleanupInterval = 15000;   // Run cleanup operation every 15 seconds
var nsio;                      // Store the namespace-restricted sockets

// Experiment initialization
module.exports = function(input) {

	// Merge passed properties with built-in properties
	properties.namespace = input.namespace;
	
	// Cache the namespaced IO
	nsio = input.socketio.of('/' + properties.namespace);
	// Run userJoin on every connection
	nsio.on('connection', userJoin);
	// Run the cleanup operation every interval
	setInterval(cleanup, cleanupInterval);
	
	// Configure routes
	for(var key in routes) {
		input.app.get('/' + properties.namespace + key, routes[key]);
	}
	
	// Return the namespace for use elsewhere
	return properties;
};

// Define routing information
var routes = {

	'/:canvasid?' : function(req, res) {
	
		var options = {
			title: 'Canvas',
			css: ['canvas.css'],
			js: ['canvas.js', '/socket.io/socket.io.js'],
			canvasID: req.params.canvasid || properties.public_canvas,
			newCanvasID: newCanvasID(8)
		}
		
		options.isPublicCanvas = (options.canvasID == properties.public_canvas) ? true : false;
		
		res.render('canvas', options);
	},
}

/***
 * Initialize the canvas storage
 */

var canvas = function() {

	this.strokes = [];
	this.sockets = {};
	this.expires = 0;
	
	this.clientCount = function() {
		var size = 0;
		for (var key in this.sockets) {
			if (this.sockets.hasOwnProperty(key)) size++;
		}
		return size;
	};
	
	this.broadcast = function(message, payload) {
		for(var n in this.sockets) {
			this.sockets[n].emit(message, payload);
		}
	}
	
	return this;
}

var canvases = {};
canvases[properties.public_canvas] = new canvas();

var cleanup = function(){
	
	for(var key in canvases) {
	
		if(key == properties.public_canvas) {
		
			if(canvases[key].expires != 0 && (canvases[key].expires <= Date.now())) {
				canvases[key].expires = 0;
				canvases[key].strokes.length = 0;
				canvases[key].broadcast('history', canvases[key].strokes);
			}
		} else {
			if(canvases[key].expires != 0 && canvases[key].expires <= Date.now()) {
				delete canvases[key];
			}
		}
	}
	
	var c = canvases[properties.public_canvas];
    c.broadcast('canvas_ttl', (c.expires == 0) ? 0 : (Date.now() + canvasLifetime - c.expires) / canvasLifetime);
}

var userJoin = function (socket) {

    var session = socket.handshake.readOnlySession;

	socket.on('canvas_join', function(canvasID) {
	
		if(typeof canvases[canvasID] == "undefined") canvases[canvasID] = new canvas();
		
		var c = canvases[canvasID];
		c.sockets[socket.id] = socket;
		
		if(canvasID == "public_canvas" && c.expires == 0) {
			c.expires = Date.now() + canvasLifetime;
		} else if (canvasID != "public_canvas" && c.expires != 0) {
			c.expires = 0;
		}
		
		socket.emit('history', c.strokes);
		c.broadcast('client_count', c.clientCount());
		
		if(canvasID == "public_canvas" && c.expires != 0) {
			socket.emit('canvas_ttl', (Date.now() + canvasLifetime - c.expires) / canvasLifetime);
		}
		
		socket.on('chat_sent', function(message) {
			if(session.identity.username !== undefined) {
				c.broadcast('chat_received', {user: session.identity.username, message: message});
			}
		});
		
		socket.on('disconnect', function() {
			delete c.sockets[socket.id];
			
			if(c.clientCount() > 0) {
				c.broadcast('client_count', c.clientCount());
			} else if (canvasID != "public_canvas") {
				c.expires = Date.now() + canvasLifetime;
			}
		});
		
		socket.on('transmit_stroke', function(stroke) {
			
			stroke = saneStroke(stroke);
			
			if(stroke !== false) {
				
				c.strokes.push(stroke);
				
				for(var n in c.sockets) {
					if(c.sockets[n] == socket) continue;
					c.sockets[n].emit('receive_stroke', stroke);
				}
			}
			
			if(canvasID == "public_canvas" && c.expires == 0) {
				c.expires = Date.now() + canvasLifetime;
			}
		});
	});
};

function saneStroke(stroke) {
	var r = {
		brush: {
			color: stroke.brush.color,
			size: parseInt(stroke.brush.size),
			type: stroke.brush.type.toString(),
		},
		coords: stroke.coords,
	};
	
	// Check the color is a valid hex
	if(!r.brush.color.match(/#[0-9A-Fa-f]/)) return false;
	// Check the size is a valid value
	if(r.brush.size < 0 || r.brush.size > 100) return false;
	
	// Check the coordinate list is not too long (10,000 elements right now)
	if(!Array.isArray(r.coords)) return false;
	if(r.coords.length > 10000) return false;
	
	for(var i = 0; i < r.coords.length; i++) {
		if(!Array.isArray(r.coords[i])) return false;
		switch(r.coords[i].length) {
			// If the array is 2 or 4 elements long, all integers
			// If 3 or 5 elements long, last item is a float
			case 5:
				r.coords[i][4] = parseFloat(r.coords[i][4]);
			case 4:
				r.coords[i][3] = parseInt(r.coords[i][3]);
				r.coords[i][2] = parseInt(r.coords[i][2]);
			case 2:
				r.coords[i][1] = parseInt(r.coords[i][1]);
				r.coords[i][0] = parseInt(r.coords[i][0]);
				break;
				
			case 3:
				r.coords[i][0] = parseInt(r.coords[i][0]);
				r.coords[i][1] = parseInt(r.coords[i][1]);
				r.coords[i][2] = parseFloat(r.coords[i][2]);
				break;
				
			default: return false;
		}
	}
	return r;
};

var newCanvasID =  function (length) 
{
	var text = "";
	var possible = "abcdefghijkmnpqrstuvxyz0123456789";
	
	for(var i=0; i < length; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	
	return text;
}
