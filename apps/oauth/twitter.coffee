# Module imports
util = require 'util'
oauth = require 'oauth'

consumer = (req) ->
	new oauth.OAuth(
		"https://twitter.com/oauth/request_token", 
		"https://twitter.com/oauth/access_token", 
		req.configuration.oauth_keys.twitter.key, 
		req.configuration.oauth_keys.twitter.secret, 
		"1.0A", 
		"http://#{req.headers.host}/#{req.namespace}/twitter/callback",
		"HMAC-SHA1"
	)

exports.connect = (req, res) ->
	consumer(req).getOAuthRequestToken (error, oauthToken, oauthTokenSecret, results) ->
		if error
			res.send(
				"Error getting OAuth request token: #{util.inspect(error)}",
				{ 'Content-Type': 'text/plain' },
				500
			)
		else
			req.session.oauthRequestToken = oauthToken
			req.session.oauthRequestTokenSecret = oauthTokenSecret
			req.session.oauthReturnURL = req.query.returnurl or "http://#{req.headers.host}"
			res.redirect "https://twitter.com/oauth/authorize?oauth_token=#{req.session.oauthRequestToken}"

exports.callback = (req, res) ->
	consumer(req).getOAuthAccessToken req.session.oauthRequestToken, req.session.oauthRequestTokenSecret, req.query.oauth_verifier, (error, oauthAccessToken, oauthAccessTokenSecret) ->
	
		# Don't need these anymore
		delete req.session.oauthRequestToken
		delete req.session.oauthRequestTokenSecret
	
		if error
			res.send(
				"Error getting OAuth access token: #{util.inspect(error)}",
				{ 'Content-Type': 'text/plain' }, 
				500
			)
			false
		
		consumer(req).get "http://twitter.com/account/verify_credentials.json", oauthAccessToken, oauthAccessTokenSecret, (error, data, response) ->
			if error
				res.send(
					"Error retrieving user data: #{util.inspect(error)}",
					{ 'Content-Type': 'text/plain' }, 
					500
				)
				false
			
			data = JSON.parse data
			req.session.identity =
				provider : 'twitter'
				username : data["screen_name"]
			
			res.redirect req.session.oauthReturnURL
