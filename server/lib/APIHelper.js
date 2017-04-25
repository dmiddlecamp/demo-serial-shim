var request = require('request');
var when = require('when');

var APIHelper = function(options) {
	if (options && options.token) {
		this._access_token = options.token;
	}

};
APIHelper.prototype = {
	_access_token: null,

	publish: function(eventTopic, eventContents, setPrivate) {
		if (!this._access_token) {
			return when.reject("access token is not set");
		}

		var that = this;
		var dfd = when.defer();


		request({
			uri: 'https://api.particle.io/v1/devices/events',
			method: 'POST',
			form: {
				name: eventTopic,
				data: eventContents,
				access_token: this._access_token,
				private: setPrivate
			},
			json: true
		},
			function (error, response, body) {
			if (error) {
				return dfd.reject(error);
			}
			if (that.hasBadToken(body)) {
				dfd.reject('Invalid token');
			}
			if (body && body.ok) {
				dfd.resolve();
			}
			else if (body && body.error) {
				dfd.reject(body);
			}
		});

		return dfd.promise;
	},

	hasBadToken: function(body) {
		if (body
			&& body.error
			&& body.error.indexOf
			&& (body.error.indexOf('invalid_token') >= 0))
		{
			console.log();
			console.log('*** Please login - it appears your access token may have expired *** ');
			console.log();
			return true;
		}
		return false;
	},

	_:null
};
module.exports = APIHelper;