stompy a node stomp client (unfinished)
=================

Having had issues with other libraries in the past, random connection drops over
a period of runtime with no reconnect for example, it seems fit to try a ground
up rewrite.

Currently written for STOMP v1.1, the intent is to support all of this protocol,
the following frame commands are unsupported at present:
 * RECEIPT
 * BEGIN
 * COMMIT
 * ABORT
 * DISCONNECT

#Usage
Require the library, and create a client:
```javascript
var stomp = require('stompy'),
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
var stomp = require('stompy'),
    client = stomp.createClient();

client.publish('/queue/foo', 'bar');
```
Other headers for a message can be provided like so:
```javascript
var stomp = require('stompy'),
client = stomp.createClient();

client.publish('/queue/foo', {persistent: true}, 'bar');
```


###Subscribing
Subscribing to a destination is as simple as:
```javascript
var stomp = require('stompy'),
    client = stomp.createClient();

client.subscribe('/queue/foo', function (msg) {
  console.info('/queue/foo:', msg);
});
```

It is a good practice to acknowledge messages from the broker, to perform this:
* Provide the option as true to the subscribe function
* Use the frame object passed back to your message handler to ack the message

```javascript
var stomp = require('stompy'),
client = stomp.createClient();

client.subscribe('/queue/foo', { ack: true } function (msg, frame) {
  console.info('/queue/foo:', msg);
  frame.ack();
  //frame.nack();
});
```
Please note that ```nack```ing a message will likely not have the desired effect unless your messages
are persistent.  


There is also the facility to subscribe to the actual internal event upon an
incoming message from the broker, could be useful if using the event pattern in
your project whilst not incurring the extra network bandwith.

```javascript
var stomp = require('stompy'),
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
var stomp = require('stompy'),
client = stomp.createClient();

var sub = client.subscribe('/queue/foo', function (msg) {
  console.info('/queue/foo:', msg);

  client.unsubscribe(sub);
});
```
