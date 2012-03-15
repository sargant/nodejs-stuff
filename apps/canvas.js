this.namespace = '/canvas';

var tickLength = 30;
var canvasClearTicks = 30;

var canvases = {
	'public': [],
}

this.init = function(nsio) {

	setInterval(function(){

		if(typeof this.tick == "undefined") this.tick = 0;
		this.tick++;
	
		if(this.tick >= canvasClearTicks) {
			this.tick = 0;
			canvases.public.length = 0;
			nsio.emit('history', canvases.public);
		}
	
		nsio.emit('canvas_ttl', (canvasClearTicks - this.tick) * tickLength);
	
	}, 1000 * tickLength);

	nsio.on('connection', function (socket) {

		socket.emit('history', 
			canvases.public
		);
	
		nsio.emit('client_count', 
			nsio.clients().length
		);
  
		socket.on('disconnect', function() {
			nsio.emit('client_count', nsio.clients().length - 1)
		});
  
		socket.on('draw', function(data) {
			canvases.public.push(data);
			socket.broadcast.emit('draw', data);
		});

	});

}
