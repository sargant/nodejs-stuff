# Set some globally accessible properties
properties =
	namespace: 'oauth'

handlers = {}

# Experiment initialization
module.exports = (input) ->
	# Merge passed properties with built-in properties
	properties.namespace = input.namespace
	# Add valid handlers
	handlers.twitter = require './twitter'
	# Configure routing
	input.app.get(
		'/' + properties.namespace + '/:oauth_handler/:oauth_method', 
		verifyOAuthHandler,
		verifyOAuthMethod,
		(req, res) ->
			req.configuration = input.configuration
			req.namespace = properties.namespace
			handlers[req.params.oauth_handler][req.params.oauth_method](req, res)
	)

	input.app.get(
		'/' + properties.namespace + '/logout',
		(req, res) ->
			delete req.session.identity
			res.redirect req.query.returnurl or  "http://" + req.headers.host
	)
	
	# Return the namespace for use elsewhere
	properties

verifyOAuthHandler = (req, res, next) ->
	if not handlers[req.params.oauth_handler]?
		res.send(
			"Unknown OAuth provider '"+req.params.oauth_handler+"'", 
			{ 'Content-Type': 'text/plain' }, 
			404
		)
	else
		next()

verifyOAuthMethod = (req, res, next) ->
	if not handlers[req.params.oauth_handler][req.params.oauth_method]?
		res.send(
			"Unknown OAuth method '"+req.params.oauth_method+"'", 
			{ 'Content-Type': 'text/plain' }, 
			404
		)
	else
		next()
