
/*
 * GET home page.
 */

this.index = function(req, res){
	res.render('index', {
		'title': 'Canvas'
	})
};
