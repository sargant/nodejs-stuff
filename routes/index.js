
/*
 * GET home page.
 */

this.index = function(req, res){
	res.render('index', {
		'title': 'Home'
	});
};

this.canvas = function(req, res){

	res.render('canvas', {
		'title': 'Canvas',
		'canvasID': (typeof req.params.canvasid != "undefined") ? req.params.canvasid : "public_canvas",
	})
};
