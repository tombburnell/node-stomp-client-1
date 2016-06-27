var net = require('net'),
    util = require('util'),
    events = require('events'),
    _ = require('lodash');

function Transport (config) {
  this.config = config;
  this.client;
  this.brokerHeartbeat;
  this.clientHeartbeat;
  this.buffer = '';

  events.EventEmitter.call(this);
}

util.inherits(Transport, events.EventEmitter);

Transport.prototype.connect = function (callback) {
  this.client = net.connect({
    host: this.config.host,
    port: this.config.port
  }, function () {
    return callback();
  });

  this.client.on('data', function (chunk) {
    chunk = chunk.toString();

    if (chunk == '\n') {
      this.parseFrame(chunk);
      return;
    }

    this.buffer += chunk;

    var frames = this.buffer.split('\00');

    if (frames.length == 1) return;

    this.buffer = frames.pop();

    _.each(frames, function (frame) {
      this.parseFrame(frame + '\00');
    } ,this);
  }.bind(this));
  this.client.on('end', function() {
    this.emit('closed');
    clearInterval(this.clientHeartbeat);
    clearInterval(this.brokerHeartbeat);
  }.bind(this));
  this.client.on('error', function (err) {
    this.emit('error', err);
  }.bind(this));
};

Transport.prototype.connected = function () {
  if (!this.client) return false;
  return this.client.writable;
};

Transport.prototype.send = function (data) {
  this.client.write(data);
};

Transport.prototype.parseFrame = function (frame) {
  if (frame == '\n') frame = 'HEARTBEAT\n\00';

  frame = frame.trim();
  var frameCommand = frame.slice(0, frame.indexOf('\n'));

  if (['ERROR', 'CONNECTED', 'MESSAGE', 'HEARTBEAT'].indexOf(frameCommand) < 0)
    console.log('Received unknown Frame Command:', frameCommand, ':', frame);

  switch(frame.slice(0, frame.indexOf('\n'))) {
    case 'ERROR':     this.bumpHeartbeat();
                      this.handleErrorFrame(frame);
                      break;
    case 'CONNECTED': this.bumpHeartbeat();
                      this.handleConnected(frame);
                      break;
    case 'MESSAGE':   this.bumpHeartbeat();
                      this.handleMessage(frame);
                      break;
    default:          this.bumpHeartbeat();
                      break;
  }

};

Transport.prototype.bumpHeartbeat = function () {
  if (this.brokerHeartbeat) {
    clearInterval(this.brokerHeartbeat);
  }
  this.brokerHeartbeat = setInterval(this.countdownBrokerHeartbeat.bind(this), this.config.heartbeat.broker + this.config.heartbeat.grace);
};

Transport.prototype.countdownBrokerHeartbeat = function () {
  this.emit('lateheartbeat');
};

Transport.prototype.setupClientHeartbeat = function () {
  if (this.clientHeartbeat) clearInterval(this.clientHeartbeat);
  this.clientHeartbeat = setInterval(this.sendHeartbeat.bind(this), this.config.heartbeat.client / 2);
};

Transport.prototype.sendHeartbeat = function () {
  if (this.client && this.client.writable) this.client.write('\n');
};

Transport.prototype.handleConnected = function (frame) {
  this.sendHeartbeat();
  this.setupClientHeartbeat();
  this.emit('connected');
};

Transport.prototype.handleMessage = function (frame) {
  var parsed = formaliseMessageFrame(frame);
  this.emit(parsed.subscription + ':msg', parsed);
};

Transport.prototype.handleErrorFrame = function (frame) {
  this.emit('transportError', frame);
};

Transport.prototype.close = function () {
  this.client.destroy();
};

function formaliseMessageFrame (frame) {
  var headersStartMarker = frame.indexOf('\n') + 1,
      headersEndMarker = frame.indexOf('\n\n'),
      headersLength = headersEndMarker - headersStartMarker,
      messageStartMarker = headersEndMarker + 2, //After \n\n.
      endByteMarker = frame.lastIndexOf('\00');

  var headers = frame.substr(headersStartMarker, headersLength),
      niceHeaders = {};

  headers = _.map(headers.split('\n'), function (header) {
    var h = {},
        hName = header.slice(0, header.indexOf(':')),
        hVal = header.substr(header.indexOf(':') + 1);

    h[hName] = hVal;
    if (niceHeaders[hName] === undefined) niceHeaders[hName] = hVal;
    else {
      if (Array.isArray(niceHeaders[hName]))
        niceHeaders[hName].push(hVal);
      else {
        niceHeaders[hName] = [niceHeaders[hName]];
        niceHeaders[hName].push(hVal);
      }
    }

    return h;
  });

  var formal = {
    rawHeaders: headers,
    headers: niceHeaders,
    destination: niceHeaders.destination,
    subscription: niceHeaders.subscription,
    message: frame.slice(0, endByteMarker).substr(messageStartMarker)
  };

  return formal;
}

module.exports = Transport;
