var SerialHelper = require('./lib/SerialHelper.js');
var APIHelper = require('./lib/APIHelper.js');
var settings = require('./settings.js');

// listen to serial comms forever

var serialHelper = new SerialHelper();
var apiHelper = new APIHelper({
	token: settings.apiToken
});


// listen for lines
// for each line, split on delim, publish

var onSerialData = function(line) {
	// parse out between start of data or last newline, and split on delim ":::"

	console.log("got serial: ", line);

	var parts = line.split(settings.delimiter);
	var topic = parts[0].trim();
	var contents = parts[1].trim();

	apiHelper.publish(topic, contents, true);
};



serialHelper.monitorPort(null, onSerialData);


