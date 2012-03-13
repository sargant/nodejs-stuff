
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

// Prevent websockets on Heroku
io.configure(function () { 
  io.set("transports", ["xhr-polling"]); 
  io.set("polling duration", 10); 
});

io.configure(function(){
  io.set('log level', 5);
});

var open_sockets = [];

function broadcast(message, contents) {
  for(var i = 0; i < open_sockets.length; i++) {
    open_sockets[i].emit(message, contents);
  }
}

io.sockets.on('connection', function (socket) {

  console.log(arguments);

  broadcast('chat', {content: socket.id + " entered the room"});
  open_sockets.push(socket);
  
  socket.on('message', function (data) {
    var timeNow = new Date();
    broadcast('chat', {content: data.content, serverTime: timeNow});
  });

  socket.on('disconnect', function() {
    console.log(arguments);
  });

});
