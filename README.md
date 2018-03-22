# amqp-rpc

different RPC-like tools over RabbitMQ for Node.js
Provides 
 * Simple rpc:  AMQPRPCClient and AMQPRPCServer
 * Remote EventEmitter: AMQPEventsSender AMQPEventsReceiver


## Getting Started
### RPC

There are two ways to run AMQPRPCServer/Client:

#### temporary queue
1. The server starts without any predefined queueName, asserts temporary queue.
2. Generated `queueName` retrieved from the `server` instance and passed somehow to the `client` (one or many). It's supposed, that this transfer isn't covered by `amqp-rpc` lib and it should be implemented somehow by the developer of code, which uses `amqp-rpc`.
3. Each client gets this queueName and uses it before initialization.

#### permanent queue
1. A queue is created somehow by an external service.
2. `server` gets the name of the queue before initialization and starts listening.
3. `client` gets the same name before initialization and uses it for sending requests.


#####Example with temporary queue:

Server:
```javascript
const amqplib = require('amqplib');
const {AMQPRPCServer, AMQPRPCClient} = require('@elasic.io/amqp-rpc');


async function init() {
  const connection = await amqplib.connect('amqp://localhost');
  
  // server start
  const server = new AMQPRPCServer(connection);
  server.addCommand('hello', (name) => ({message: `Hello, ${name}!`}));  
  await server.start();
  
  // name of temporary queue, has to be passed somehow to client by external service
  const requestsQueue = server.requestsQueue;
  
  // client start
  const client = new AMQPRPCClient(connection, {requestsQueue});
  await client.start();
  const response = await client.sendCommand('hello', ['Alisa']);
  console.log('Alisa got response:', response);
  
  return {server, client};
}
```
Full working example you could find [here](examples/amqp-rpc-with-tmp-queue.js).


######Example with permanent queue:

```javascript
const amqplib = require('amqplib');
const {AMQPRPCServer, AMQPRPCClient} = require('@elasic.io/amqp-rpc');


async function init() {
  
  const connection = await amqplib.connect('amqp://localhost');
  
  // initial setup (e.g. should be provided on first launch)
  const queueName = 'predefined-queue-name';
  const channel = await connection.createChannel();
  await channel.assertQueue(queueName);
  
  // server start
  const server = new AMQPRPCServer(connection, {queueName});
  server.addCommand('hello', (name) => ({message: `Hello, ${name}!`}));
  await server.start();
  
  // client start
  const client = new AMQPRPCClient(connection, {requestsQueue:queueName});
  await client.start();
  const response = await client.sendCommand('hello', ['Alisa']);
  console.log('Alisa got response:', response);
  
  return {server, client};
}
```

Full working example you could find [here](examples/amqp-rpc-with-permanent-queue.js).

#### Server handlers

To register a new RPC command in the server, use `addCommand()` method:

```javascript
server.addCommand('hello', (name) => ({message: `Hello, ${name}!`}));
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
