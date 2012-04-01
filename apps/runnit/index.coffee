request = require 'request'
DomJS = (require 'dom-js').DomJS

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
			
	'?' : (req, res) -> res.redirect("/#{properties.namespace}/")
	
	'garmin-connect.json' : (req, res) =>
	
		if not req.query.url?
			return res.json
				error : "No URL received"
		
		garminUrl = req.query.url.match /connect\.garmin\.com\/activity\/([0-9]+)/
		
		if garminUrl is null
			return res.json
				error : "Not a valid Garmin Connect URL"
		
		request "http://connect.garmin.com/proxy/activity-service-1.1/gpx/activity/#{garminUrl[1]}?full=true", (error, response, body) ->
			if error or response.statusCode isnt 200
				return res.json
					error : "Could not load file from Garmin Connect. Is it public?"
			else parseGPXFile body, (error, json) ->
				if error isnt null
					res.json 
						error: error
				else
					res.json json

parseGPXFile = (xmlString, callback) ->
	parser = new DomJS
	parser.parse xmlString, (error, dom) ->
		if error 
			callback "Error parsing GPX file", null
		else
			response = []
			for trk in dom.children
				if trk.name is 'trk'
					for trkseg in trk.children
						if trkseg.name is 'trkseg'
							for trkpt in trkseg.children
								if trkpt.name is 'trkpt'
									object = {}
									object.lon = trkpt.attributes?.lon
									object.lat = trkpt.attributes?.lat
									
									for subprops in trkpt.children
										if subprops.name is 'ele'
											object.ele = subprops.children?[0]?.text
										if subprops.name is 'time'
											object.time = Date.parse subprops.children?[0]?.text
											
									response.push object
			callback null, response
