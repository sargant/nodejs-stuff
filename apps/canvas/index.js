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
		res.render('canvas', {
			'title': 'Canvas',
            'css': ['canvas'],
			'canvasID': req.params.canvasid || properties.public_canvas,
		})
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
                for(var n in c.sockets) {
                    if(c.sockets[n] == socket) continue;
                    c.sockets[n].emit('chat_received', {user: session.identity.username, message: message});
                }
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
            
            if(stroke.coords.length > 0) {
                
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
