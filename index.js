var _ = require('lodash'),
    StompClient = require('./lib/Client');

var defaultConfig = {
  host: 'localhost',
  port: 61613,
  heartbeat: {
    client: 5000,
    broker: 5000,
    grace: 2000
  }
};

function create(options, callback) {
  var config = _.extend(defaultConfig, options);

  return new StompClient(config, callback);
}

module.exports = {
  createClient: create
}

var client = create({port: 61623}, function () {
  console.info('Connected on STOMP.');
  setInterval(function() {
    client.publish('/queue/a', JSON.stringify({ prop: 'ZOMG An object', time: new Date() }));
  }, 5000);


  client.subscribe('/queue/a', function (msg) {
    console.log('Received a msg', JSON.parse(msg));
  });
});
