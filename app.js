
// Set up Express server

var express = require('express');
var routes = require('./routes');

var conf = require('./conf')();

var app = express.createServer();

// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.favicon());
  app.use(express.cookieParser()),
  app.use(express.session(conf.session_config)),
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
  app.use(express.errorHandler());
});

//////////////////////////////////////////////////////////////////////////////
// Set up sockets

var io = require('socket.io').listen(app);

// Configure for heroku
io.configure(function () { 
  io.set("transports", ["xhr-polling"]); 
  io.set("polling duration", 10); 
  io.set('log level', 2);
});

//////////////////////////////////////////////////////////////////////////////
// Set up experiments

app.get('/', routes.index);

app.get('/sessions', function(req, res){
  var body = '';
  if (req.session.views) {
    ++req.session.views;
  } else {
    req.session.views = 1;
    body += '<p>First time visiting? view this page in several browsers :)</p>';
  }
  res.send(body + '<p>viewed <strong>' + req.session.views + '</strong> times.</p>');
});

var canvas = require('./apps/canvas');
canvas.init(io.of(canvas.namespace));
app.get('/canvas/:canvasid?', routes.canvas);

//////////////////////////////////////////////////////////////////////////////
// Launch server

app.listen(process.env.PORT || 3000);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
