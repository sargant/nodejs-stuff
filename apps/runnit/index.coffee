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
	'' : (req, res) ->
		options = 
			title : 'Runnit'
			css : ['runnit.css']
			js : ['runnit.js']
			
		res.render 'runnit', options
			
	'?' : (req, res) ->	res.redirect("/#{properties.namespace}/")
	
	'garmin-connect.json' : (req, res) =>
	
		if not req.query.url?
			res.json
				error : "No URL received"
		else if not req.query.url.match /^http:\/\/connect.garmin.com\/activity\/[0-9]+$/
			res.json
				error : "Not a valid Garmin Connect URL"
		else
			res.json
				error : "Not yet implemented"