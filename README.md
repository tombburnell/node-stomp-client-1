node-stomp-client (unfinished)
=================

Having had issues with other libraries in the past, random connection drops over
a period of runtime with no reconnect for example, it seems fit to try a ground
up rewrite.

Currently written for STOMP v1.1, the intent is to support all of this protocol,
the following frame types are unsupported at present:
 * RECEIPT
 * ACK
 * NACK
 * BEGIN
 * COMMIT
 * ABORT
 * DISCONNECT

#Usage
Require the library, and create a client:
```javascript
var stomp = require('stomp-client'),
    client = stomp.createClient();
```

In the ```createClient()``` method an options object can be passed, the defaults
look like:

```javascript
{
  host: 'localhost',
  port: 61613,
  heartbeat: {
    client: 5000,
    broker: 5000,
    grace: 2000
  }
}
```
N.B: In tests it seems unreliable to have heartbeat timeouts lower than 5 seconds.

###Publish
To publish to a destination:
```javascript
var stomp = require('stomp-client'),
    client = stomp.createClient();

client.publish('/queue/foo', 'bar');
```

###Subscribing
Subscribing to a destination is as simple as:
```javascript
var stomp = require('stomp-client'),
    client = stomp.createClient();

client.subscribe('/queue/foo', function (msg) {
  console.info('/queue/foo:', msg);
});
```

There is also the facility to subscribe to the actual internal event upon an
incoming message from the broker, could be useful if using the event pattern in
your project whilst not incurring the extra network bandwith.

```javascript
var stomp = require('stomp-client'),
client = stomp.createClient();

var sub client.subscribe('/queue/foo', function (msg) {
  console.info('/queue/foo:', msg);
});

client.subscribeToEvent(sub, function (msg) {
  // ...
});
```

###Unsubscribing
Unsubscribing from a destination is just as easy:
```javascript
var stomp = require('stomp-client'),
client = stomp.createClient();

var sub = client.subscribe('/queue/foo', function (msg) {
  console.info('/queue/foo:', msg);

  client.unsubscribe(sub);
});
```
