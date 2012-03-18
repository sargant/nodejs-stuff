var MongoStore = require('connect-mongo');

module.exports = function() { return {
	'session_config': session_config(),
	'oauth_keys': oauth_keys(),
}};

var session_config = function() {

	var r = {
		'secret': session_secret(),
		'key': 'connect.sid',
		'cookie': {
			'maxAge': 1000 * 60 * 60 * 24 * 14,
		},
	};
	
	var v = session_storage(r.cookie.maxAge);
	if(v) r.store = v;
	
	return r;
}

var session_secret = function() {
	if(typeof process.env.SESSION_SECRET == "undefined") {
		console.warn(" [WARNING] Using default value for session_secret");
		console.warn("           Please set the environment variable SESSION_SECRET");
		return "0xDEADBEEF";
	} else {
		return process.env.SESSION_SECRET;
	}
}

var session_storage = function(maxAge) {
	
	if(typeof process.env.MONGOLAB_URI != "undefined") {
		console.info("    [INFO] Using MongoLab DB storage");
		return new MongoStore({
			'url' : process.env.MONGOLAB_URI,
			'clear_interval' : maxAge,
		});
	}
	
	console.warn(" [WARNING] Using volatile MemoryStore for sessions");
	return false;
}

var oauth_keys = function() {

	var k = {};
	
	k.twitter = { 'key': '', 'secret': ''};
	
	if(typeof process.env.TWITTER_CONSUMER_KEY == "undefined") {
		console.warn(" [WARNING] No value for environment variable TWITTER_CONSUMER_KEY");
	} else k.twitter.key = process.env.TWITTER_CONSUMER_KEY;
	
	if(typeof process.env.TWITTER_CONSUMER_SECRET == "undefined") {
		console.warn(" [WARNING] No value for environment variable TWITTER_CONSUMER_SECRET");
	} else k.twitter.secret = process.env.TWITTER_CONSUMER_SECRET;
	
	return k;
}