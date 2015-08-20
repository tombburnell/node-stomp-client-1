var _ = require('lodash'),
    StompClient = require('./lib/Client');

var defaultConfig = {
  host: 'localhost',
  port: 61613,
  retryOnClosed:true,
  heartbeat: {
    client: 5000,
    broker: 5000,
    grace: 2000
  }
};

function create(options, callback) {
  var config = _.merge(_.cloneDeep(defaultConfig), options);

  return new StompClient(config, callback);
}

module.exports = {
  createClient: create
};
