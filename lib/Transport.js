var net = require('net'),
    util = require('util'),
    events = require('events'),
    _ = require('lodash');

function Transport (config) {
  this.config = config;
  this.client;

  events.EventEmitter.call(this);

}

util.inherits(Transport, events.EventEmitter);

Transport.prototype.connect = function (callback) {
  this.client = net.connect({
    host: this.config.host,
    port: this.config.port
  }, function () {
    console.info('Connected to TCP');
    return callback();
  });

  this.client.on('data', function (frame) {
    console.info(frame.toString());
    this.parseFrame(frame);
  }.bind(this));
  this.client.on('end', function() {
    console.log('disconnected from server.');
  });
}

Transport.prototype.send = function (data) {
  this.client.write(data);
}

Transport.prototype.parseFrame = function (frame) {
  frame = frame.toString();
  console.log('Frame Command:', frame.slice(0, frame.indexOf('\n')));

  switch(frame.slice(0, frame.indexOf('\n'))) {
    case 'ERROR':     this.handleErrorFrame(frame);
                      break;
    case 'CONNECTED': this.handleConnected(frame);
                      break;
    case 'MESSAGE':   this.handleMessage(frame);
  }

}

Transport.prototype.handleConnected = function (frame) {
  console.info('Connected on STOMP.');
  this.emit('connected');
}

Transport.prototype.handleMessage = function (frame) {
  var parsed = formaliseMessageFrame(frame);
  this.emit('msg:' + parsed.destination, parsed);
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
    message: frame.slice(0, endByteMarker).substr(messageStartMarker)
  }

  return formal;
}

module.exports = Transport;
