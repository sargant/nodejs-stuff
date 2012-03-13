
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

io.sockets.on('connection', function (socket) {

  var update_clients = function() {
      io.sockets.emit('update_clients', {'clients': io.sockets.clients().map(function(x) { return x.id }) });
  }
  
  update_clients();
  
  socket.on('get_clients', update_clients);
  socket.on('disconnect', function() {io.sockets.emit('should_request_updated_clients')});
  
  socket.on('draw', function(data) {
    io.sockets.emit('draw', data);
  });

});
