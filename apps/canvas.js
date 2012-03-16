/***
 * Set some globally accessible properties
 */
this.namespace = '/canvas';

/***
 * Internal properties
 */
 
var canvasLifetime = 1000 * 60 * 0.5;
var nsio;

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
canvases.public_canvas = new canvas();

/***
 * Now run the app
 */

this.init = function(namespaced_io) {

	nsio = namespaced_io;
	nsio.on('connection', userjoin);
	setInterval(cleanup, 1000 * 1);
};

var cleanup = function(){

	// This runs once every fifteen seconds
	
	for(var key in canvases) {
	
		switch(key) {
		
			case "public_canvas":
			
				if(canvases[key].expires != 0 && (canvases[key].expires <= Date.now())) {
					console.log("Clearing the public canvas");
					canvases[key].expires = 0;
					canvases[key].strokes.length = 0;
					canvases[key].broadcast('history', canvases[key].strokes);
				}
				
				break;
				
			default:
				if(canvases[key].expires != 0 && canvases[key].expires <= Date.now()) {
					
					delete canvases[key];
					console.log("Deleting canvas " + key + " due to inactivity");
				}
				break;
		}
	}
	
    if(canvases.public_canvas.expires != 0) {
        canvases.public_canvas.broadcast('canvas_ttl', (Date.now() + canvasLifetime - canvases.public_canvas.expires) / canvasLifetime);
    } else {
        canvases.public_canvas.broadcast('canvas_ttl', 0);
    }
}

var userjoin = function (socket) {

	socket.on('canvas_join', function(canvasID) {
	
		console.log("Socket " + socket.id + " joined canvas " + canvasID);
	
		if(typeof canvases[canvasID] == "undefined") canvases[canvasID] = new canvas();
		
		var c = canvases[canvasID];
		c.sockets[socket.id] = socket;
		
		if(canvasID == "public_canvas" && c.expires == 0) {
            c.expires = Date.now() + canvasLifetime;
        } else if (c.expires != 0) {
            c.expires = 0;
        }

		socket.emit('history', c.strokes);
		c.broadcast('client_count', c.clientCount());
		
		if(canvasID == "public_canvas" && c.expires != 0) {
			socket.emit('canvas_ttl', (Date.now() + canvasLifetime - c.expires) / canvasLifetime);
		}
  
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
