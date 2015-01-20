var _ = require('lodash'),
    Transport = require('./Transport');

function Client (config, connectedCallback) {
  this.config = config;
  this.subscriptionId = 0;
  this.subscriptions = {};
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
  var subscription = {
    id: this.subscriptionId++,
    func: function (msg) { return handler(msg.message, msg); },
    get event() {
      return '' + this.id + ':msg:' + destination
    }
  };

  this.subscriptions[subscription.id] = subscription;
  this._sendStompMessage('subscribe', {id: subscription.id, destination: destination});
  this.transport.on(subscription.event, subscription.func);

  return subscription;
}

Client.prototype.unsubscribe = function (subscription) {
  if (subscription.id != undefined) subscription = subscription.id;

  if (this.subscriptions[subscription]){
    this._sendStompMessage('unsubscribe', {id: subscription});
    this.transport.removeListener(this.subscriptions[subscription].event, this.subscriptions[subscription].func);
    delete this.subscriptions[subscription];
  }
}

Client.prototype.subscribeToEvent = function (sub, handler) {
  if (! sub.event) return false;

  this.transport.on(sub.event, handler);
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
