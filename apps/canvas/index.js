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
	
	// Load brush data from JSON
	properties.brushSpecs = require("./brush-specs.json");
	
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
	this.messages = [];
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

/**
 * Define a cleanup function to be run periodically
 */

var cleanup = function(){
	
	for(var key in canvases) {
	
		if(key == properties.public_canvas) {
			// If this is the public canvas and has a passed expiry date
			if(canvases[key].expires != 0 && (canvases[key].expires <= Date.now())) {
				// Remove the expiry date - wait for first action to start countdown
				canvases[key].expires = 0;
				// Reset stroke history
				canvases[key].strokes = [];
				canvases[key].strokes.length = 0;
				// Broadcast the new blank history to all connected clients
				canvases[key].broadcast('history', canvases[key].strokes);
			}
		} else {
			// If this is a private canvas, we assume there is nobody here
			// and delete the canvas outright
			if(canvases[key].expires != 0 && canvases[key].expires <= Date.now()) {
				delete canvases[key];
			}
		}
	}
	
	// Broadcast the progression through the public canvas life, as a fraction in [0,1]
	var c = canvases[properties.public_canvas];
    c.broadcast('canvas_ttl', (c.expires == 0) ? 0 : (Date.now() + canvasLifetime - c.expires) / canvasLifetime);
}

/**
 * Define actions to be run when a user connects
 */
 
var userJoin = function (socket) {
	
	// Grab the session data
	var session = socket.handshake.readOnlySession;
	
	// Don't do anything on client connect, wait for a "canvas connect" message
	socket.on('canvas_join', function(canvasID) {
	
		// Create the canvas if it is new
		if(typeof canvases[canvasID] == "undefined") canvases[canvasID] = new canvas();
		
		// Add this socket to the list held by the canvas
		var c = canvases[canvasID];
		c.sockets[socket.id] = socket;
		
		// If this is the public canvas and it has no expiry date, set one now
		if(canvasID == properties.public_canvas && c.expires == 0) {
			c.expires = Date.now() + canvasLifetime;
		// If this is a private canvas and it has an expiry date, remove it now
		} else if (canvasID != properties.public_canvas && c.expires != 0) {
			c.expires = 0;
		}
		
		// Send the stroke history and chat history to the client
		socket.emit('stroke_history', c.strokes);
		socket.emit('chat_history', c.messages);
		// Send the client count to all sockets connected to the canvas
		c.broadcast('client_count', c.clientCount());
		
		// If we're on the public canvas, send the expiry time now rather
		// than waiting for the next TTL heartbeat
		if(canvasID == properties.public_canvas && c.expires != 0) {
			socket.emit('canvas_ttl', (Date.now() + canvasLifetime - c.expires) / canvasLifetime);
		}
		
		// Listen for messages received from the client, and send to everyone
		socket.on('chat_sent', function(message) {
			// Only send if the session has a valid username
			if(session.identity.username !== undefined) {
				var message = {
					user: session.identity.username,
					message: message,
					time: Date.now()
				};
				
				// Broadcast the message
				c.broadcast('chat_received', message);
				// Add the message to the canvas history
				c.messages.push(message);
				// Only maintain the 20 latest messages
				while(c.messages.length > 20) c.messages.shift();
			}
		});
		
		// Listen for disconnection and remove socket from canvas
		socket.on('disconnect', function() {
			
			delete c.sockets[socket.id];
			// Tell all connected sockets about the updated client count
			c.broadcast('client_count', c.clientCount());
			
			// If we're on a private canvas and there's nobody left,
			// set an expiry time for the cleanup function to monitor
			if (c.clientCount() < 1 && canvasID != properties.public_canvas) {
				c.expires = Date.now() + canvasLifetime;
			}
		});
		
		// Listen for strokes being sent from the client
		socket.on('transmit_stroke', function(stroke) {
			
			// Sanitize the strokes sent from the client and ensure
			// they are well-formed
			stroke = saneStroke(stroke);
			if(stroke === false) return;
			
			// Add the stroke to the canvas, and rebroadcast to
			// everybody except the source client
			c.strokes.push(stroke);
			for(var n in c.sockets) {
				if(c.sockets[n] == socket) continue;
				c.sockets[n].emit('receive_stroke', stroke);
			}
			
			// If this is the public canvas and it has no expiry date, set one now
			if(canvasID == "public_canvas" && c.expires == 0) {
				c.expires = Date.now() + canvasLifetime;
			}
		});
	});
};

/***
 * Sanitizes and verifies incoming stroke commands
 */
 
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
	if(!r.brush.color.match(/^#[0-9A-Fa-f]{6}$/)) return false;
	// Check the size is a valid value
	if(r.brush.size < 0 || r.brush.size > 100) return false;
	
	// Check the coordinate list is not too long (10,000 elements right now)
	if(!Array.isArray(r.coords)) return false;
	if(r.coords.length > 10000) return false;
	
	for(var i = 0; i < r.coords.length; i++) {
		if(!Array.isArray(r.coords[i])) return false;
		switch(r.coords[i].length) {
			// If the array is 2 or 4 elements long, all integers
			// If 3 or 5 elements long, last item is a float (opacity)
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

/***
 * Generate random strings for creating new canvases
 */
var newCanvasID =  function (length) 
{
	var text = "";
	var possible = "abcdefghijkmnpqrstuvxyz0123456789";
	
	for(var i=0; i < length; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	
	return text;
}
