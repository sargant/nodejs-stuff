
/*
 * GET home page.
 */

this.index = function(req, res){
	res.render('index', {
		'title': 'Home'
	});
};

this.canvas = function(req, res){

	var privateCanvas = (typeof req.params.canvasid != "undefined") ? true : false

	res.render('canvas', {
		'title': 'Canvas',
		'privateCanvas': privateCanvas,
		'originalUrl': req.originalUrl,
		'genurl': '/canvas/' + pageID(8)
	})
};



 
var pageID = function(length)
{
    var text = "";
    var possible = "abcdefghijklmnopqrstuvwxyz0123456789";

    for(var i=0; i < length; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}