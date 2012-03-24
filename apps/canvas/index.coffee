# Set some globally accessible properties
properties =
	namespace: 'canvas'
	public_canvas: 'public_canvas'

# Internal variables
canvasLifetime = 900000 # Delete canvases after 15 minutes
cleanupInterval = 15000 # Run cleanup operation every 15 seconds
nsio = null             # Store the namespace-restricted sockets

# Experiment initialization
module.exports = (input) -> 
	# Merge passed properties with built-in properties
	properties.namespace = input.namespace
	# Cache the namespaced IO
	nsio = input.socketio.of '/' + properties.namespace
	# Run userJoin on every connection
	nsio.on 'connection', userJoin
	# Run the cleanup operation every interval
	setInterval cleanup, cleanupInterval
	# Load brush data from JSON
	properties.brushSpecs = require './brush-specs.json'
	# Configure routes
	input.app.get '/' + properties.namespace + key, route for key, route of routes
	# Return the namespace for use elsewhere
	return properties

# Define routing information
routes = 
	'/:canvasid?' : (req, res) ->
		options = 
			title : 'Canvas'
			css : ['canvas.css']
			js : ['canvas.js', '/socket.io/socket.io.js']
			canvasID : req.params.canvasid or properties.public_canvas
			newCanvasID : newCanvasID(8)
			brushSpecs : properties.brushSpecs
			
		options.isPublicCanvas = if options.canvasID is properties.public_canvas then true else false
		
		res.render 'canvas', options

# Initialize the canvas storage
canvas = () ->
	@strokes = []
	@messages = []
	@sockets = {}
	@expires = 0
	
	@clientCount = () ->
		size = 0
		size += 1 for socket of @sockets
		size
	
	@broadcast = (message, payload) ->
		socket.emit(message, payload) for socketid, socket of @sockets
	
	@

# Initialize public canvases
canvases = {}
canvases[properties.public_canvas] = new canvas()

# Define a cleanup function to be run periodically
cleanup = () ->
	for key, canvas of canvases
		if key is properties.public_canvas
			# If this is the public canvas and has a passed expiry date
			if canvas.expires isnt 0 and canvas.expires <= Date.now()
				# Remove the expiry date - wait for first action to start countdown
				canvases.expires = 0
				# Reset stroke history
				canvases.strokes = []
				canvases.strokes.length = 0
				# Broadcast the new blank history to all connected clients
				canvases.broadcast 'history', canvases.strokes
		else
			# If this is a private canvas, we assume there is nobody here
			# and delete the canvas outright
			delete canvas if canvas.expires isnt 0 and canvas.expires <= Date.now()
	
	# Broadcast the progression through the public canvas life, as a fraction in [0,1]
	c = canvases[properties.public_canvas]
	c.broadcast 'canvas_ttl', if c.expires is 0 then 0 else (Date.now() + canvasLifetime - c.expires) / canvasLifetime

# Define actions to be run when a user connects
userJoin = (socket) ->
	# Grab the session data
	session = socket.handshake.readOnlySession

	# Don't do anything on client connect, wait for a "canvas connect" message
	socket.on 'canvas_join', (canvasID) -> 
	
		# Create the canvas if it doesn't alrerady exist
		canvases[canvasID] ?= new canvas()
		
		# Add this socket to the list held by the canvas
		c = canvases[canvasID]
		c.sockets[socket.id] = socket
		
		# If this is the public canvas and it has no expiry date, set one now
		if canvasID is properties.public_canvas and c.expires is 0
			c.expires = Date.now() + canvasLifetime
		else if canvasID isnt properties.public_canvas and c.expires isnt 0
			c.expires = 0
		
		# Send the stroke history and chat history to the client
		socket.emit 'stroke_history', c.strokes
		socket.emit 'chat_history', c.messages
		# Send the client count to all sockets connected to the canvas
		c.broadcast 'client_count', c.clientCount()
		
		# If we're on the public canvas, send the expiry time now rather
		# than waiting for the next TTL heartbeat
		if canvasID is properties.public_canvas and c.expires isnt 0
			socket.emit 'canvas_ttl', (Date.now() + canvasLifetime - c.expires) / canvasLifetime
		
		# Listen for messages received from the client, and send to everyone
		socket.on 'chat_sent', (message) ->
			# Only send if the session has a valid username
			if session.identity.username?
				message =
					user : session.identity.username
					message: message
					time: Date.now()
				
				# Broadcast the message
				c.broadcast 'chat_received', message
				# Add the message to the canvas history
				c.messages.push message
				# Only maintain the 20 latest messages
				c.messages.shift() while c.messages.length > 20
		
		# Listen for disconnection and remove socket from canvas
		socket.on 'disconnect', () ->
			delete c.sockets[socket.id]
			# Tell all connected sockets about the updated client count
			c.broadcast 'client_count', c.clientCount()
			
			# If we're on a private canvas and there's nobody left,
			# set an expiry time for the cleanup function to monitor
			c.expires = Date.now() + canvasLifetime if c.clientCount() < 1 and canvasID isnt properties.public_canvas
			
		# Listen for strokes being sent from the client
		socket.on 'transmit_stroke', (stroke) ->
			
			# Sanitize the strokes sent from the client and ensure
			# they are well-formed
			stroke = saneStroke stroke
			return if stroke is false
			
			# Add the stroke to the canvas, and rebroadcast to
			# everybody except the source client
			c.strokes.push stroke
			s.emit 'receive_stroke', stroke for socketid, s of c.sockets when s isnt socket
			
			# If this is the public canvas and it has no expiry date, set one now
			c.expires = Date.now() + canvasLifetime if canvasID is properties.public_canvas and c.expires is 0

# Generate random strings for creating new canvases
newCanvasID = (length) ->
	text = ""
	possible = "abcdefghijkmnpqrstuvxyz0123456789"
	text += (possible.charAt Math.floor Math.random() * possible.length) for i in [1..length]
	return text

# Sanitizes and verifies incoming stroke commands
saneStroke = (stroke) ->
	r = 
		brush:
			color: stroke.brush.color
			size: parseInt stroke.brush.size
			type: stroke.brush.type.toString()
		coords: stroke.coords
	
	brushProps = properties.brushSpecs.brushes[r.brush.type]
	
	# Check this is a valid brush definition
	return false if not brushProps?
	# Check the color is a valid hex
	return false if not r.brush.color.match(/^#[0-9A-Fa-f]{6}$/)
	# Check the size is a valid value
	return false if r.brush.size < 0 or r.brush.size > 100
	
	# Check the coordinate list is not too long (10,000 elements right now)
	return false if not Array.isArray r.coords or r.coords.length > 10000
	
	for i in r.coords
		return false if not Array.isArray i
		
		switch i.length
			# If the array is 2 or 4 elements long, all integers
			# If 3 or 5 elements long, last item is a float (opacity)
			when 2, 4, 5
				i[4] = parseFloat i[4] if i.length is 5
				i[3] = parseInt i[3] if i.length >= 4
				i[2] = parseInt i[2] if i.length >= 4
				i[1] = parseInt i[1]
				i[0] = parseInt i[0]
			when 3
				i[2] = parseFloat i[2]
				i[0] = parseInt i[0]
				i[1] = parseInt i[1]
			else return false
	r
