var net = require('net'),
    util = require('util'),
    events = require('events'),
    _ = require('lodash');

function Transport (config) {
  this.config = config;
  this.client;
  this.brokerHeartbeat;
  this.clientHeartbeat;

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

  this.client.on('data', function (frame) {
    this.parseFrame(frame);
  }.bind(this));
  this.client.on('end', function() {
    this.emit('closed');
    clearInterval(this.clientHeartbeat);
    clearInterval(this.brokerHeartbeat);
  }.bind(this));
}

Transport.prototype.connected = function () {
  if (!this.client) return false;
  return this.client.writable;
}

Transport.prototype.send = function (data) {
  this.client.write(data);
}

Transport.prototype.parseFrame = function (frame) {
  frame = frame.toString();
  if (frame == '\n') frame = 'HEARTBEAT\n';

  var frameCommand = frame.slice(0, frame.indexOf('\n'))

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

}

Transport.prototype.bumpHeartbeat = function () {
  if (this.brokerHeartbeat) {
    clearInterval(this.brokerHeartbeat);
  }
  this.brokerHeartbeat = setInterval(this.countdownBrokerHeartbeat.bind(this), this.config.heartbeat.broker + this.config.heartbeat.grace);
}

Transport.prototype.countdownBrokerHeartbeat = function () {
  console.warn('WARN:Server is late on a heartbeat');
}

Transport.prototype.setupClientHeartbeat = function () {
  if (this.clientHeartbeat) clearInterval(this.clientHeartbeat);
  this.clientHeartbeat = setInterval(this.sendHeartbeat.bind(this), this.config.heartbeat.client / 2);
}

Transport.prototype.sendHeartbeat = function () {
  if (this.client && this.client.writable) this.client.write('\n');
}

Transport.prototype.handleConnected = function (frame) {
  this.sendHeartbeat();
  this.setupClientHeartbeat();
  this.emit('connected');
}

Transport.prototype.handleMessage = function (frame) {
  var parsed = formaliseMessageFrame(frame);
  this.emit(parsed.subscription + ':msg:' + parsed.destination, parsed);
}

Transport.prototype.handleErrorFrame = function (frame) {
  console.error('ERROR:', frame);
  this.emit('transportError', frame);
}

function formaliseMessageFrame (frame) {
  var headersStartMarker = frame.indexOf('\n') + 1,
      headersEndMarker = frame.indexOf('\n\n'),
      headersLength = headersEndMarker - headersStartMarker,
      messageStartMarker = headersEndMarker + 2, //After \n\n.
      endByteMarker = frame.lastIndexOf('\00');

  var headers = frame.substr(headersStartMarker, headersLength);
  headers = _.map(headers.split('\n'), function (header) {
    var h = {};
    h[header.slice(0, header.indexOf(':'))] = header.substr(header.indexOf(':') + 1);
    return h;
  });

  var formal = {
    rawHeaders: headers,
    destination: _.find(headers, function (h) { return h.destination }).destination,
    subscription: _.find(headers, function (h) { return h.subscription }).subscription,
    message: frame.slice(0, endByteMarker).substr(messageStartMarker)
  }

  return formal;
}

module.exports = Transport;
