$(function () {

	var removeRunLog = function (event) {
		$(event.target).blur()
		event.preventDefault()
		
		var row = $(event.target).parent().parent();
		row.fadeOut(400, function () { row.remove() })
		
		return false
	}
	
	var addRunningLogFromURL = function (event) {
		$(event.target).blur()
		event.preventDefault()
		
		var garminUrl = $('#runlogs-add-input-url').val()
		
		if (garminUrl === "") return false
		$('#runlogs-add-message').slideDown(100)
		
		
		$.ajax({
			url: './garmin-connect.json',
			data: {
				url: garminUrl
			}
		}).error(function () {
			$('#runlogs-add-message').addClass("error").html("<strong>Error:</strong> Could not load data. Try again?")
		}).success(function (response) {
			if(response.error) {
				$('#runlogs-add-message').addClass("error").html("<strong>Error:</strong> " + res.error.toString())
			} else {
				$('#runlogs-add-message').slideUp(100)
				$('#runlogs-add-input-url').val("")
				console.log(response)
			}
		})
		
		/*
		
		var url = $('#runlogs-add-input-url').val()
		var newRow = $('<tr>')
		
		newRow.append('<td><label class="checkbox"><input type="checkbox" checked /> 28th Mar 2012</label></td>')
		newRow.append('<td>5.00 K</td>')
		newRow.append('<td>27:08</td>')
		newRow.append('<td><a href="#" class="runlogs-remove">Remove</a></td>')
		
		$('#runlogs-add-row').before(newRow)
		newRow.hide().fadeIn(400)
		
		$('.runlogs-remove').on('click', removeRunLog)
		
		*/
		
		return false
	}

	$('#runlogs-add').click(function (event) {
		$('#runlogs-add-input').slideDown(100)
		this.blur()
		event.preventDefault()
		return false
	})
	
	$('#runlogs-add-input').on('submit', addRunningLogFromURL)
	$('#runlogs-add-input-submit').on('click', addRunningLogFromURL)
	
	$('#runlogs-add-input-cancel').click(function (event) {
		$(event.target).blur()
		event.preventDefault()
	
		$('#runlogs-add-input').slideUp(100)
		$('#runlogs-add-message').removeClass("error").hide()
		$('#runlogs-add-input-url').val("")
		return false
	})
	

})