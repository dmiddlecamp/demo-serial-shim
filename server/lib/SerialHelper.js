var SerialPort = require('serialport');
var _ = require('lodash');
var specs = require('./deviceSpecs');

var SerialHelper = function() {

}
SerialHelper.prototype = {
	options: {
		follow: true
	},

	findDevices: function (callback) {
		var devices = [];
		SerialPort.list(function (err, ports) {
			if (err) {
				console.error('Error listing serial ports: ', err);
				return callback([]);
			}

			ports.forEach(function (port) {
				// manufacturer value
				// Mac - Spark devices
				// Devices on old driver - Spark Core, Photon
				// Devices on new driver - Particle IO (https://github.com/spark/firmware/pull/447)
				// Windows only contains the pnpId field

				var device;
				var serialDeviceSpec = _.find(specs, function (deviceSpec) {
					if (!deviceSpec.serial) {
						return false;
					}
					var vid = deviceSpec.serial.vid;
					var pid = deviceSpec.serial.pid;
					var serialNumber = deviceSpec.serial.serialNumber;

					var usbMatches = (port.vendorId === '0x' + vid.toLowerCase() && port.productId === '0x' + pid.toLowerCase());
					var pnpMatches = !!(port.pnpId && (port.pnpId.indexOf('VID_' + vid.toUpperCase()) >= 0) && (port.pnpId.indexOf('PID_' + pid.toUpperCase()) >= 0));
					var serialNumberMatches = port.serialNumber && port.serialNumber.indexOf(serialNumber) >= 0;

					if (usbMatches || pnpMatches || serialNumberMatches) {
						return true;
					}
					return false;
				});
				if (serialDeviceSpec) {
					device = {
						port: port.comName,
						type: serialDeviceSpec.productName
					};
				}

				var matchesManufacturer = port.manufacturer && (port.manufacturer.indexOf('Particle') >= 0 || port.manufacturer.indexOf('Spark') >= 0 || port.manufacturer.indexOf('Photon') >= 0);
				if (!device && matchesManufacturer) {
					device = { port: port.comName, type: 'Core' };
				}

				if (device) {
					devices.push(device);
				}
			});

			//if I didn't find anything, grab any 'ttyACM's
			if (devices.length === 0) {
				ports.forEach(function (port) {
					//if it doesn't have a manufacturer or pnpId set, but it's a ttyACM port, then lets grab it.
					if (port.comName.indexOf('/dev/ttyACM') === 0) {
						devices.push({ port: port.comName, type: '' });
					} else if (port.comName.indexOf('/dev/cuaU') === 0) {
						devices.push({ port: port.comName, type: '' });
					}
				});
			}

			callback(devices);
		});
	},

	whatSerialPortDidYouMean: function (comPort, shouldPrompt, callback) {
		var self = this;

		this.findDevices(function (devices) {
			var port = self._parsePort(devices, comPort);
			if (port) {
				return callback(port);
			}

			if (!devices || devices.length === 0) {
				return callback(undefined);
			}

			inquirer.prompt([
				{
					name: 'port',
					type: 'list',
					message: 'Which device did you mean?',
					choices: devices.map(function (d) {
						return {
							name: d.port + ' - ' + d.type,
							value: d
						};
					})
				}
			], function (answers) {
				callback(answers.port);
			});
		});
	},

	_parsePort: function(devices, comPort) {
		if (!comPort) {
			//they didn't give us anything.
			if (devices.length === 1) {
				//we have exactly one device, use that.
				return devices[0];
			}
			//else - which one?
		} else {
			var portNum = parseInt(comPort);
			if (!isNaN(portNum)) {
				//they gave us a number
				if (portNum > 0) {
					portNum -= 1;
				}

				if (devices.length > portNum) {
					//we have it, use it.
					return devices[portNum];
				}
				//else - which one?
			} else {
				var matchedDevices = devices.filter(function (d) {
					return d.port === comPort;
				});
				if (matchedDevices.length) {
					return matchedDevices[0];
				}

				//they gave us a string
				//doesn't matter if we have it or not, give it a try.
				return { port: comPort, type: '' };
			}
		}

		return null;
	},



	monitorPort: function(comPort, callback) {
		var cleaningUp = false;
		var selectedDevice;
		var serialPort;

		var displayError = function(err) {
			if (err) {
				console.error('Serial err: ' + err);
				console.error('Serial problems, please reconnect the device.');
			}
		};

		// Called when port closes
		var handleClose = function() {
			if (self.options.follow && !cleaningUp) {
				console.log('Serial connection closed.  Attempting to reconnect...');
				reconnect();
			} else {
				console.log('Serial connection closed.');
			}
		};

		// Handle interrupts and close the port gracefully
		var handleInterrupt = function() {
			if (!cleaningUp) {
				console.log('Caught Interrupt.  Cleaning up.');
				cleaningUp = true;
				if (serialPort && serialPort.isOpen()) {
					serialPort.flush(function() {
						serialPort.close();
					})
				}
			}
		}

		// Called only when the port opens successfully
		var handleOpen = function() {
			console.log('Serial monitor opened successfully:');
		};

		var handlePortFn = function(device) {
			if (!device) {
				if (self.options.follow) {
					setTimeout(function() {
						self.whatSerialPortDidYouMean(comPort, true, handlePortFn);
					}, 5);
					return;
				} else {
					console.error('No serial device identified');
					return;
				}
			}

			console.log('Opening serial monitor for com port: "' + device.port + '"');
			selectedDevice = device;
			openPort();
		};

		var openPort = function() {
			serialPort = new SerialPort(selectedDevice.port, {
				baudrate: 9600,
				autoOpen: false
			});
			serialPort.on('close', handleClose);
			serialPort.on('data', function(data) {
				//process.stdout.write(data.toString());
				callback(data.toString());
			});
			serialPort.on('error', displayError);
			serialPort.open(function(err) {
				if (err && self.options.follow) {
					reconnect(selectedDevice);
				} else if (err) {
					displayError(err);
				} else {
					handleOpen();
				}
			});
		};

		var reconnect = function() {
			setTimeout(function() {
				openPort(selectedDevice);
			}, 5);
		}

		process.on('SIGINT', handleInterrupt);
		process.on('SIGQUIT', handleInterrupt);
		process.on('SIGTERM', handleInterrupt);
		process.on('exit', handleInterrupt);

		if (this.options.follow) {
			console.log('Polling for available serial device...');
		}

		var self = this;
		this.whatSerialPortDidYouMean(comPort, true, handlePortFn);
	},

	_:null
};

module.exports = SerialHelper;