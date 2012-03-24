MongoStore = require 'connect-mongo'
express    = require 'express'

module.exports = () ->
	session_config : session_config()
	oauth_keys : oauth_keys()

session_config = () ->
	r =
		secret : session_secret()
		key : 'connect.sid'
		cookie :
			maxAge : 1000 * 60 * 60 * 24 * 14
	
	v = session_storage r.cookie.maxAge
	r.store = v if v
	r

session_secret = () ->
	if not process.env.SESSION_SECRET?
		console.warn ' [WARNING] Using default value for session_secret'
		console.warn '           Please set the environment variable SESSION_SECRET'
		'0xDEADBEEF'
	else
		process.env.SESSION_SECRET

session_storage = (maxAge) ->
	if process.env.MONGOLAB_URI?
		console.info '    [INFO] Using MongoLab DB storage'
		new MongoStore
			url : process.env.MONGOLAB_URI
			clear_interval : maxAge
	else 
		console.warn ' [WARNING] Using volatile MemoryStore for sessions'
		new express.session.MemoryStore()

oauth_keys = () -> 
	k = {}
	k.twitter =
		key : ''
		secret : ''
	
	if not process.env.TWITTER_CONSUMER_KEY?
		console.warn ' [WARNING] No value for environment variable TWITTER_CONSUMER_KEY'
	else 
		k.twitter.key = process.env.TWITTER_CONSUMER_KEY
	
	if not process.env.TWITTER_CONSUMER_SECRET?
		console.warn ' [WARNING] No value for environment variable TWITTER_CONSUMER_SECRET'
	else
		k.twitter.secret = process.env.TWITTER_CONSUMER_SECRET
	k
