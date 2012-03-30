$(function() {

	var socket = io.connect('/bikes')
	
	// Calculate latency
	var latencyPing = function (wait) {
		setTimeout(function () {
			socket.emit('ping', Date.now())
		}, wait)
	}; latencyPing(500)
	
	socket.on('pong', function(msg) {
		$('#game-latency').text(Date.now() - parseInt(msg))
		latencyPing(2000)
	})
	
	var playAudio = function (type) {
		
		if (this.fileExt === undefined) {
			var a = document.createElement("audio")
			if(typeof a.canPlayType !== "function") this.fileExt = null
			else this.fileExt = (a.canPlayType("audio/mpeg") !== "") ? ".mp3" : ".ogg"
		}
		
		var sounds = {
			beep: "/assets/audio/beep",
			crash: "/assets/audio/crash",
			win: "/assets/audio/upwards"
		}
		
		if(sounds[type] !== undefined && this.FileExt !== null)
			new Audio(sounds[type] + this.fileExt).play()
	}

	var gameCanvas = {
		element: $('#game-canvas').get(0),
		context: $('#game-canvas').get(0).getContext('2d')
	}
	
	var gameExtent = [41, 31]
	
	$(document).keydown(function(event) {
	
		var captured = true
		var d = null;
		
		switch (event.which) {
			case 87: d = 'n'; break
			case 83: d = 's'; break
			case 68: d = 'e'; break
			case 65: d = 'w'; break
			default: captured = false
		}
		
		if (captured) {
			if(typeof r.setDirection === "function") r.setDirection(d)
			event.preventDefault()
			return false
		}
	})
	
	var runGame = function () {
		
		// The playing grid consists of 41x31 squares, each of size 15 pixels
		// Initialize the grid as empty
		var grid = []
		for(var i = 0; i < gameExtent[0]; i++) {
			grid[i] = []
			for(var j = 0; j < gameExtent[1]; j++) {
				grid[i][j] = false
			}
		}
		
		var positions = {
			us: [[20, 27]],
			them: [[20, 3]]
		}
		
		var directions = {
			us: "n",
			them: "s"
		}
		
		var intervalClock = null
		var turnCounter = 0
		
		this.updateGameCanvas = function () {
		
			ctx = gameCanvas.context
			ctx.save()
			
			// Clear any old game remnants
			ctx.clearRect(0, 0, gameCanvas.element.height, gameCanvas.element.width)
			
			ctx.strokeStyle = "transparent"
			ctx.lineWidth = 0
			
			var colors = {
				us: ['#FFBB33', '#996E1E', '#7F5B19', '#664814'],
				them: ['#33B5E5', '#1C637C', '#165063', '#113C49']
			}
			
			for(var who in positions) {
				// Go in reverse order
				for(var i = positions[who].length - 1; i >= 0; i--) {
			
					var color = (colors[who].length > 1) ? colors[who].shift() : colors[who][0]
					ctx.fillStyle = color
					
					//ctx.fillStyle = (distanceFromEnd >= colors[who].length) ? colors[who][colors[who].length-1] : colors[who][distanceFromEnd]
					var square = positions[who][i]
				
					ctx.beginPath()
					ctx.rect(square[0]*15, square[1]*15, 15, 15)
					
					ctx.stroke()
					ctx.fill()
				}
			}
			
			ctx.restore()
		}
		
		this.nextMove = function () {
		
			turnCounter++
		
			var newPositions = {
				us: [positions.us[positions.us.length-1][0], positions.us[positions.us.length-1][1]],
				them: [positions.them[positions.them.length-1][0], positions.them[positions.them.length-1][1]]
			}
			
			for(var who in directions) {
				switch (directions[who]) {
					case 'n': newPositions[who][1] -= 1; break
					case 's': newPositions[who][1] += 1; break
					case 'e': newPositions[who][0] += 1; break
					case 'w': newPositions[who][0] -= 1; break
					default: console.error("Invalid direction")
				}
			}
			
			// Grid position may be true (occupied) or undefined (out of bounds)
			// We also must check if we both enter the same square at the same time
			if(grid[newPositions.us[0]][newPositions.us[1]] !== false) {
				playAudio("crash")
				clearInterval(intervalClock)
				$('#game-message').text("You lose. Idiot.").addClass("game-lose")
				
			} else if(grid[newPositions.them[0]][newPositions.them[1]] !== false) {
				playAudio("win")
				clearInterval(intervalClock)
				$('#game-message').text("You win!").addClass("game-win")
				
			}else {
				
				positions.us.push([newPositions.us[0], newPositions.us[1]])
				positions.them.push([newPositions.them[0], newPositions.them[1]])
				
				grid[newPositions.us[0]][newPositions.us[1]] = true
				grid[newPositions.them[0]][newPositions.them[1]] = true
				
				updateGameCanvas()
				
				if(newPositions.us[0] == newPositions.them[0] && newPositions.us[1] == newPositions.them[1]) {
					playAudio("crash")
					clearInterval(intervalClock)
					$('#game-message').text("You lose. Idiot.").addClass("game-lose")
				} else {
					playAudio("beep")
				}
			}
		}
		
		this.setDirection = function (d) { 
		
			var inverses = { "n":"s", "n":"s", "e":"w", "w":"e"}
		
			if(directions.us !== d && inverses[directions.us] !== d) {
				directions.us = d
				// Re-emit the last five moves in case of a problem
				socket.emit('player_move', {t: turnCounter, d: d, p: positions.us.slice(-5)})
			}
		}
		
		this.go = function () {
			updateGameCanvas()
			intervalClock = setInterval(this.nextMove, 600)
		}
		
		go()
		return this
	}

	var r = runGame()
})
