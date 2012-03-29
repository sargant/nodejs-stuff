# Set some globally accessible properties
properties =
	namespace: 'bikes'

# Internal variables
nsio = null                 # Store the namespace-restricted sockets

# Experiment initialization
module.exports = (input) -> 
	properties.namespace = input.namespace               # Merge passed properties with built-in properties
	nsio = input.socketio.of "/#{properties.namespace}"  # Cache the namespaced IO
	nsio.on 'connection', userJoin                       # Run userJoin on every connection
	
	# Configure routes
	input.app.get "/#{properties.namespace}/#{key}", route for key, route of routes
	# Return the namespace for use elsewhere
	properties

# Define routing information
routes = 
	'' : (req, res) ->
		options = 
			title : 'Bikes'
			js : ['/socket.io/socket.io.js']
		res.render 'bikes', options

userJoin = -> {} # do nothing for now