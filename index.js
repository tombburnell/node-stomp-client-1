var _ = require('lodash'),
    StompClient = require('./lib/Client');

var defaultConfig = {
  host: 'localhost',
  port: 61613
};

function create(options, callback) {
  var config = _.extend(defaultConfig, options);

  return new StompClient(config, callback);
}

module.exports = {
  createClient: create
}

var client = create({port: 61623}, function () {
  console.log('Apparently we connected');
  client.publish('/queue/a', new Date().toString());

  client.subscribe('/queue/a', function (msg) {
    console.log('Received a msg', msg);
  });
});
