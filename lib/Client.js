var _ = require('lodash'),
    Transport = require('./Transport');

function Client (config, connectedCallback) {
  this.config = config;
  this.subscriptionId = 0;
  this.subscriptions = {};
  this.bufferedMessages = [];
  this.bufferInterval;
  this.transport = this.createNewTransport(config, connectedCallback);
}

Client.prototype.createNewTransport = function (config, connectedCallback) {
  var transport = new Transport(config);

  transport.connect(function () {
    this._sendStompMessage('connect', {
      'accept-version': '1.1',
      host: config.host,
      'heart-beat': '' + config.heartbeat.client + ',' + config.heartbeat.broker},'', true);

      transport.once('connected', function () {
        if (this.bufferInterval) clearInterval(this.bufferInterval);
        this.bufferInterval = setInterval(this.nextBufferedMessage.bind(this), 50);

        this.replaySubscriptions();

        if (connectedCallback) return connectedCallback();
      }.bind(this));
  }.bind(this));

  transport.on('closed', function () {
    console.warn('Transport closed.');
    this.transport = this.createNewTransport(this.config);
  }.bind(this));

  return transport;
};

Client.prototype.replaySubscriptions = function () {
  _.each(this.subscriptions, function (sub) {
    this._subscribe(sub);
  }, this);
};

Client.prototype.publish = function (destination, message) {
  this._sendStompMessage(
    'send',
    {
      destination: destination,
      'content-type': 'application/json'
    },
    message);
};

Client.prototype.subscribe = function (destination, handler) {
  var subscription = {
    id: this.subscriptionId++,
    func: function (msg) { return handler(msg.message, msg); },
    destination: destination,
    get event() {
      return '' + this.id + ':msg';
    }
  };

  this.subscriptions[subscription.id] = subscription;
  this._subscribe(subscription);

  return subscription;
};

Client.prototype._subscribe = function (subscription) {
  this._sendStompMessage('subscribe', {id: subscription.id, destination: subscription.destination});
  this.transport.on(subscription.event, subscription.func);
};

Client.prototype.unsubscribe = function (subscription) {
  if (subscription.id !== undefined) subscription = subscription.id;

  if (this.subscriptions[subscription]){
    this._sendStompMessage('unsubscribe', {id: subscription});
    this.transport.removeListener(this.subscriptions[subscription].event, this.subscriptions[subscription].func);
    delete this.subscriptions[subscription];
  }
};

Client.prototype.subscribeToEvent = function (sub, handler) {
  if (! sub.event) return false;

  this.transport.on(sub.event, handler);
};

Client.prototype._sendStompMessage = function (command, headers, message, bypassBuffer) {
  headers = headers || [];
  message = message || '';

  var output = _([
    command.toUpperCase(),
    _.map(headers, function (val, header) { return header + ':' + val; }),
    '',
    message,
    '\x00'
  ]).flatten().value().join('\n');

  if (!bypassBuffer) this.bufferedMessages.push(output);
  else this.transport.send(output);
};

Client.prototype.nextBufferedMessage = function () {
  if (this.transport && this.transport.connected()) {
    var message = this.bufferedMessages.splice(0,1)[0];
    if (message) this.transport.send(message);
  } else {
    this.transport = this.createNewTransport(this.config);
  }
};

module.exports = Client;
