/***
 * Set some globally accessible properties
 */
this.namespace = '/canvas';

/***
 * Internal properties
 */
 
var canvasLifetime = 1000 * 60 * 15;
var nsio;

/***
 * Initialize the canvas storage
 */
 
var canvas = function() {

	this.strokes = [];
	this.sockets = {};
	this.initialized = Date.now();
	this.inactive = true;
	
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
	setInterval(cleanup, 1000 * 15);
};

var cleanup = function(){

	// This runs once every fifteen seconds
	
	for(var key in canvases) {
	
		switch(key) {
		
			case "public_canvas":
			
				if((canvases[key].initialized + canvasLifetime <= Date.now())
					&& (!canvases[key].inactive || canvases[key].strokes.length > 0)) {
					
					console.log("Clearing the public canvas");
					canvases[key].initialized = Date.now();
					canvases[key].strokes.length = 0;
					canvases[key].broadcast('history', canvases[key].strokes);
				}
				
				break;
				
			default:
				if(canvases[key].inactive 
					&& canvases[key].initialized + canvasLifetime <= Date.now()) {
					
					delete canvases[key];
					console.log("Deleting canvas " + key + " due to inactivity");
				}
				break;
		}
	}
	
	canvases.public_canvas.broadcast('canvas_ttl', (Date.now() - canvases.public_canvas.initialized) / canvasLifetime);
}

var userjoin = function (socket) {

	socket.on('canvas_join', function(canvasID) {
	
		console.log("Socket " + socket.id + " joined canvas " + canvasID);
	
		if(typeof canvases[canvasID] == "undefined") {
			canvases[canvasID] = new canvas();
			this.empty = false;
		}
		
		var c = canvases[canvasID];
		c.sockets[socket.id] = socket;
		
		if(c.inactive) {
			c.inactive = false;
			if(canvasID != "public_canvas") c.initialized = Date.now();
		}

		socket.emit('history', c.strokes);
		c.broadcast('client_count', c.clientCount());
		
		if(canvasID == "public_canvas") {
			socket.emit('canvas_ttl', (Date.now() - canvases.public_canvas.initialized) / canvasLifetime);
		}
  
		socket.on('disconnect', function() {
			delete c.sockets[socket.id];
			
			if(c.clientCount() > 0) {
				c.broadcast('client_count', c.clientCount());
			} else {
				c.inactive = true;
				if(canvasID != "public_canvas") c.initialized = Date.now();
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
        });
	});
};
