
# Set up Express server
conf         = (require './conf')()
connectUtils = (require 'connect').utils
express      =  require 'express'

app = express.createServer()

# Configuration
app.configure ->
	app.set 'views', "#{__dirname}/views"
	app.set 'view engine', 'ejs'
	app.use express.bodyParser()
	app.use express.methodOverride()
	app.use express.favicon()
	app.use express.cookieParser()
	app.use express.session conf.session_config
	app.use express.static "#{__dirname}/public"
	app.use app.router

# Environment-specific configuration
app.configure 'development', ->
	app.use express.errorHandler
		dumpExceptions: true
		showStack: true

app.configure 'production', ->
	app.use express.errorHandler()

# Static helpers - pre-populate css and js to avoid errors
app.helpers
	css: []
	js:  []

# Dynamic helpers
app.dynamicHelpers
	identity: (req, res) -> req.session.identity ? {}
	url:      (req, res) -> encodeURIComponent req.url

# #######################
# Set up sockets
# #######################

sockets = (require 'socket.io').listen app

# Configure for heroku
sockets.configure ->
	# Configure for heroku specifically, no websockets
	sockets.set 'transports', ['xhr-polling']
	sockets.set 'polling duration', 10
	sockets.set 'log level', 1
	sockets.set 'authorization', (handshakeData, callback) ->
		# If there is a cookie...
		if handshakeData.headers.cookie?
			sid = (connectUtils.parseCookie handshakeData.headers.cookie)[conf.session_config.key]
			conf.session_config.store.get sid, (err, session) ->
				handshakeData.readOnlySession = session ? {}
		callback null, true

# ###########################
# Set up apps with namespaces
# ###########################

canvas = (require './apps/canvas')
	namespace: 'canvas'
	app: app
	socketio: sockets

oauth = (require './apps/oauth')
	namespace : 'oauth'
	app : app
	configuration : conf

app.get '/', (req, res) ->
	res.render 'index',
		title : 'Home'

# ###########################
# Launch server
# ###########################

app.listen process.env.PORT or 3000
console.log "Server listening on port #{app.address().port} in #{app.settings.env} mode"
