# Set some globally accessible properties
properties =
	namespace: 'runnit'

# Experiment initialization
module.exports = (input) -> 
	# Merge passed properties with built-in properties
	properties.namespace = input.namespace
	
	# Configure routes
	input.app.get "/#{properties.namespace}/#{key}", route for key, route of routes
	# Return the namespace for use elsewhere
	properties

# Define routing information
routes = 
	'?' : (req, res) ->
		options = 
			title : 'Runnit'
			css : ['runnit.css']
			js : ['runnit.js']
			
		res.render 'runnit', options
