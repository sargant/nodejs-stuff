
// Set up Express server

var express = require('express');
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

app.dynamicHelpers({
	identity: function(req, res){
		return (typeof req.session.identity == "undefined") ? {} : req.session.identity;
	},
	'url': function(req) {
		return encodeURIComponent(req.url);
	},
});

//////////////////////////////////////////////////////////////////////////////
// Set up sockets

var sockets = require('socket.io').listen(app);

// Configure for heroku
sockets.configure(function () { 
  sockets.set("transports", ["xhr-polling"]); 
  sockets.set("polling duration", 10); 
  sockets.set('log level', 2);
  sockets.set('authorization', function(handshakeData, callback) {
	handshakeData.readOnlySession = {
		string: "Hello there " + handshakeData.address.address,
	};
	callback(null, true);
  });
});

//////////////////////////////////////////////////////////////////////////////
// Set up experiments

var canvas = require('./apps/canvas')({
	namespace: 'canvas',
	socketio: sockets,
	app: app,
});

var oauth = require('./apps/oauth')({
	namespace: 'oauth',
	app: app,
	configuration: conf,
});

app.get('/', function(req, res){
	res.render('index', {
		'title': 'Home'
	});
});

//////////////////////////////////////////////////////////////////////////////
// Launch server

app.listen(process.env.PORT || 3000);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
