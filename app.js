
// Set up Express server

var express = require('express');
var routes = require('./routes');

var app = module.exports = express.createServer();

// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
  app.use(express.errorHandler());
});

// Routes

app.get('/', routes.index);

app.listen(process.env.PORT || 3000);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);

//////////////////////////////////////////////////////////////////////////////
// Set up sockets

var io = require('socket.io').listen(app);

// Configure for heroku
io.configure(function () { 
  io.set("transports", ["xhr-polling"]); 
  io.set("polling duration", 10); 
  io.set('log level', 2);
});

var shapes = [];

var tickLength = 30;
var canvasClearTicks = 30;

setInterval(function(){

	if(typeof this.tick == "undefined") this.tick = 0;
	this.tick++;
	
	if(this.tick >= canvasClearTicks) {
		this.tick = 0;
		shapes.length = 0;
		io.sockets.emit('history', shapes);
	}
	
	io.sockets.emit('canvas_ttl', (canvasClearTicks - this.tick) * tickLength);
	
}, 1000 * tickLength);

io.sockets.on('connection', function (socket) {

	socket.emit('history', 
		shapes
	);
	
	io.sockets.emit('client_count', 
		io.sockets.clients().length
	);
  
	socket.on('disconnect', function() {
		io.sockets.emit('client_count', io.sockets.clients().length - 1)
	});
  
	socket.on('draw', function(data) {
		shapes.push(data);
		socket.broadcast.emit('draw', data);
	});

});
