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
	':gameid?' : (req, res) ->
		options = 
			title : 'Bikes'
			js : ['bikes.js', '/socket.io/socket.io.js']
		res.render 'bikes', options

game = 
	p1: null
	p2: null

userJoin = (socket) ->
	
	console.log "Socket #{socket.id} joined"
	
	socket.on 'ping', (timestamp) ->
		socket.emit 'pong', parseInt(timestamp)
	
	if game.p1 is null
		us = "p1"
		them = "p2"
		game.p1 = socket
		console.log "Socket #{socket.id} is player 1"
	else if game.p2 is null
		us = "p2"
		them = "p1"
		game.p2 = socket
		console.log "Socket #{socket.id} is player 2"
	else
		console.log "Not participlating"
	
	socket.on 'disconnect', ->
		console.log "#{game[us].id} disconnected"
		game[us] = null
	
	socket.on 'player_move', (move) ->
		console.log "Player #{us} moves #{move.d} on turn #{move.t} with #{move.p.length} historical points"
