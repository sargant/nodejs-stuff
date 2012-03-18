// Set some globally accessible properties
var properties = {
	namespace: 'oauth',
}

// Module imports
var sys = require('util');
var oauth = require('oauth');

// Experiment initialization
module.exports = function(input) {

	// Merge passed properties with built-in properties
	properties.namespace = input.namespace;
	
	// Configure routes
	for(var key in routes) {
		input.app.get('/' + properties.namespace + key, routes[key]);
	}
	
	input.app.dynamicHelpers({
		session: function(req, res){
			return req.session;
		}
	});
	
	// Return the namespace for use elsewhere
	return properties;
};

// Define routing information
var routes = {

	'/connect' : function(req, res){
		consumer().getOAuthRequestToken(function(error, oauthToken, oauthTokenSecret, results){
			if (error) {
				res.send("Error getting OAuth request token : " + sys.inspect(error), 500);
			} else {  
				req.session.oauthRequestToken = oauthToken;
				req.session.oauthRequestTokenSecret = oauthTokenSecret;
				res.redirect("https://twitter.com/oauth/authorize?oauth_token="+req.session.oauthRequestToken);      
			}
		});
	},

	'/callback' : function(req, res){
		consumer().getOAuthAccessToken(req.session.oauthRequestToken, req.session.oauthRequestTokenSecret, req.query.oauth_verifier, function(error, oauthAccessToken, oauthAccessTokenSecret, results) {
			if (error) {
				res.send("Error getting OAuth access token : " + sys.inspect(error) + "["+oauthAccessToken+"]"+ "["+oauthAccessTokenSecret+"]"+ "["+sys.inspect(results)+"]", 500);
			} else {
				req.session.oauthAccessToken = oauthAccessToken;
				req.session.oauthAccessTokenSecret = oauthAccessTokenSecret;
				// Right here is where we would write out some nice user stuff
				consumer().get("http://twitter.com/account/verify_credentials.json", req.session.oauthAccessToken, req.session.oauthAccessTokenSecret, function (error, data, response) {
					if (error) {
						res.send("Error getting twitter screen name : " + sys.inspect(error), 500);
					} else {
						data = JSON.parse(data);
						req.session.twitterScreenName = data["screen_name"];    
						res.send('You are signed in: ' + req.session.twitterScreenName + "<pre>" + sys.inspect(data) + "</pre>");
					}  
				});  
			}
		});
	},
}



var _twitterConsumerKey = process.env.TWITTER_CONSUMER_KEY;
var _twitterConsumerSecret = process.env.TWITTER_CONSUMER_SECRET;

function consumer() {
  return new oauth.OAuth(
    "https://twitter.com/oauth/request_token", 
	"https://twitter.com/oauth/access_token", 
    _twitterConsumerKey, 
	_twitterConsumerSecret, 
	"1.0A", 
	"http://nodejs.sargant.com/oauth/callback", 
	"HMAC-SHA1");   
};

