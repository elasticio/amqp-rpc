# amqp-rpc

different RPC-like tools over RabbitMQ for Node.js
Provides 
 * Simple rpc:  AMQPRPCClient and AMQPRPCServer
 * Remote EventEmitter: AMQPEventsSender AMQPEventsReceiver


## Getting Started
### RPC

To create a new instance of RPC server/client for RabbitMQ:

```javascript
const amqplib = require('ampqlib');
const {AMQPRPCServer, AMQPRPCClient} = require('@elasic.io/amqp-rpc');
const exchange = 'EXCHANGE';
const key = 'KEY';

async function init() {
  const connection = await amqplib.connect('amqp://localhost');
  const server = new AMQPRPCServer(connection);
  await server.start();
  const requestsQueue = server.requestsQueue;
  
  const client = new AMQPRPCClient(connection, {requestsQueue});
  await client.start();
  
  return {server, client};
}
```

To register a new RPC command in the server, use `addCommand()` method:

```javascript
server.addCommand('print-hello-world', (name) => {
  console.log('Hello, ${name}!');
  
  return {foo: 'bar'};
});
```

Handler could also return a promise or async function, e.g.:

```javascript
server.addCommand('print-hello-world', (name) => Promise.resolve({ message: 'ok' });
```

To call an RPC command from the client, use `sendCommand()` method:

```javascript
const result = await client.sendCommand('print-hello-world', [
  'World'
]);

assert.deepEqual(result, {foo: 'bar'});
```

### Event Emitter
Events receiver side code
````javascript
  const { AMQPEventsReceiver } = require('@elastic.io/amqp-rpc');
  const amqp = require('amqplib')

  .......
  const amqpConnection = await amqp.connect('amqp://localhost');
   
  const receiver = new AMQPEventsReceiver(amqpConnection);
  
  receiver
    .on('end', () => {
      console.log('Sender stops to send events, so nothing to do more, disconnecting'); 
    })
    .on('close', () => {
      console.log('Disconnected'); 
    })
    .on('error', (e) => {
      console.log('Error happens', e);
    })
    .on('data', (msg) => {
      console.log('We\'ve got a message', msg); 
    });

  await receiver.start();
  const queueName = receiver.queueName; 
  
  console.log(`Use ${queueName} as QUEUE_TO_SEND_EVENTS in sender part of code`); 
  ........
  await receiver.disconnect();
  await amqpConnection.close();

````
Events source side code
````javascript
  const { AMQPEventsSender } = require('@elastic.io/amqp-rpc');
  const amqp = require('amqplib')

  .......
  const amqpConnection = await amqp.connect('amqp://localhost');
   
  const sender = new AMQPEventsSender(amqpConnection, 'QUEUE_TO_SEND_EVENTS');
  sender
    .on('close', () => {
      console.log('Receiver endpoint has been removed, so sender stop to work'); 
    })
    .on('error', (e) => {
      console.log('Error happens', e);
    });

  const data = {
    key: 'value'
  };

  await sender.start();
  await sender.send(data);
  
  ........
  await sender.disconnect();
  await amqpConnection.close();

````
