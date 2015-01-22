var stomp = require('./index');
var client = stomp.createClient({port: 61623, heartbeat: { client: 2000}}, function () {
  console.info('Connected on STOMP.');
  setInterval(function() {
    client.publish('/queue/a', JSON.stringify({ prop: 'ZOMG An object', time: new Date() }));
  }, 5000);


  var first = client.subscribe('/queue/a', function (msg) {
    console.log('Received a msg', JSON.parse(msg));
  });

  var second = client.subscribe('/queue/a', function (msg) {
    console.log('Got the msg on 2nd subscription, unsubcribing. id', second.id);
    client.unsubscribe(second);
  });

  var third = client.subscribeToEvent(first, function (msg) {
    console.log('Fires everytime the original does.');
  });


  //Test a socket close.
  setTimeout(function () {
    clearInterval(client.transport.clientHeartbeat);
  },8000);
});
