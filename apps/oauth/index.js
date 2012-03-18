// Set some globally accessible properties
var properties = {
	namespace: 'oauth',
};

var handlers = {};

// Experiment initialization
module.exports = function(input) {

	// Merge passed properties with built-in properties
	properties.namespace = input.namespace;
	
	// Add valid handlers
	handlers.twitter = require('./twitter');
	
	// Configure routing
	input.app.get(
		'/' + properties.namespace + '/:oauth_handler/:oauth_method', 
		verifyOAuthHandler,
		verifyOAuthMethod,
		function(req, res) {
			req.configuration = input.configuration;
			req.namespace = properties.namespace;
			handlers[req.params.oauth_handler][req.params.oauth_method](req, res);
		}
	);

	input.app.get(
		'/' + properties.namespace + '/logout',
		function(req, res) {
			delete req.session.identity;
			res.redirect(req.query.returnurl || "http://" + req.headers.host);
		}
	);
	
	// Return the namespace for use elsewhere
	return properties;
};

function verifyOAuthHandler(req, res, next) {
	if(typeof handlers[req.params.oauth_handler] == "undefined") {
		res.send(
			"Unknown OAuth provider '"+req.params.oauth_handler+"'", 
			{ 'Content-Type': 'text/plain' }, 
			404
		);
	} else next();
};

function verifyOAuthMethod(req, res, next) {
	if(typeof handlers[req.params.oauth_handler][req.params.oauth_method] == "undefined") {
		res.send(
			"Unknown OAuth method '"+req.params.oauth_method+"'", 
			{ 'Content-Type': 'text/plain' }, 
			404
		);
	} else next();
};
