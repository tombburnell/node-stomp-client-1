var _ = require('lodash'),
    Transport = require('./Transport');

function Client (config, connectedCallback) {
  this.config = config;
  this.subscriptionId = 0;

  this.transport = new Transport(config);

  this.transport.connect(function () {
    this._sendStompMessage('connect', {
      'accept-version': '1.1',
      host: this.config.host,
      'heart-beat': '' + this.config.heartbeat.client + ',' + this.config.heartbeat.broker});

    this.transport.once('connected', function () {
      return connectedCallback();
    })
  }.bind(this));
}

Client.prototype.publish = function (destination, message) {
  this._sendStompMessage(
    'send',
    {
      destination: destination,
      'content-type': 'application/json'
    },
    message);
}

Client.prototype.subscribe = function (destination, handler) {
  //Send subscription message
  this._sendStompMessage('subscribe', {id: this.subscriptionId++, destination: destination});;
  this.transport.on('msg:' + destination, function (msg) {
    return handler(msg.message, msg);
  });
}

Client.prototype._sendStompMessage = function (command, headers, message) {
  headers = headers || [];
  message = message || '';

  var output = _([
    command.toUpperCase(),
    _.map(headers, function (val, header) { return header + ':' + val }),
    '',
    message,
    '\x00'
  ]).flatten().value().join('\n');

  this.transport.send(output);
}

module.exports = Client;
