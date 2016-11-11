var _ = require('lodash'),
    util = require('util'),
    Transport = require('./Transport'),
    events = require('events');

function Client (config, connectedCallback) {
  this.config = config;
  this.subscriptionId = 0;
  this.subscriptions = {};
  this.bufferedMessages = [];
  this.bufferInterval;
  this.transport = this.createNewTransport(config, connectedCallback);

  events.EventEmitter.call(this);
}

util.inherits(Client, events.EventEmitter);

Client.prototype.createNewTransport = function (config, connectedCallback) {
  var transport = new Transport(config);

  transport.connect(function () {
    this._sendStompMessage('connect', {
      'accept-version': '1.1',
      host: config.host,
      login: config.login,
      passcode: config.passcode,
      'heart-beat': '' + config.heartbeat.client + ',' + config.heartbeat.broker},'', true);

      transport.once('connected', function () {
        if (this.bufferInterval) clearInterval(this.bufferInterval);
        this.bufferInterval = setInterval(this.nextBufferedMessage.bind(this), 50);

        this.replaySubscriptions();

        if (connectedCallback) return connectedCallback();
      }.bind(this));
  }.bind(this));

  transport.on('closed', function () {
    this.emit('transportClosed');
    if (_.has(this.config,'retryOnClosed') && this.config.retryOnClosed === true) {
      this.transport = this.createNewTransport(this.config);
    }
  }.bind(this));

  transport.on('error', function (err) {
    this.emit('error', err);
  }.bind(this));

  transport.on('transportError', function (frame) {
    this.emit('transportError', frame);
  }.bind(this));

  transport.on('lateheartbeat', function () {
    this.emit('lateheartbeat');
  }.bind(this));

  return transport;
};

Client.prototype.replaySubscriptions = function () {
  _.each(this.subscriptions, function (sub) {
    this._subscribe(sub);
  }, this);
};

Client.prototype.publish = function (destination, extraHeaders, message) {
  if ((!message)) extraHeaders = (message = extraHeaders, {});
  this._sendStompMessage(
    'send',
    _.merge({
      destination: destination,
      'content-type': 'application/json'
    }, extraHeaders),
    message);
};

Client.prototype.subscribe = function (destination, options, handler) {
  if ((!handler) && typeof(options) == 'function') options = (handler = options, {});

  var subscription = {
    id: this.subscriptionId++,
    ack: options.ack ? 'client-individual' : 'auto',
    func: function (msg) { return handler(msg.message, this.attachAckFunc(msg)); }.bind(this),
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
  this._sendStompMessage('subscribe', {
    id: subscription.id,
    destination: subscription.destination,
    ack: subscription.ack
  });
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
  } 
else {
 //   console.log("nextBufferedMessage");
 //   this.transport = this.createNewTransport(this.config);
  }
};

Client.prototype.attachAckFunc = function (msg) {
  var headers = {
    subscription: _.find(msg.rawHeaders, 'subscription').subscription,
    'message-id': _.find(msg.rawHeaders, 'message-id')['message-id']
  };

  msg.ack = function () {
    this._sendStompMessage('ack', headers);
  }.bind(this);

  msg.nack = function () {
    this._sendStompMessage('nack', headers);
  }.bind(this);

  return msg;
};

Client.prototype.close = function() {
  if (this.bufferInterval) {
    clearInterval(this.bufferInterval);
    this._sendStompMessage('disconnect', undefined, undefined, true);
    this.transport.close();
  }
};

module.exports = Client;
