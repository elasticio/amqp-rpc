# amqp-rpc

RPC over RabbitMQ for Node.js

## Getting Started

To create a new instance of RPC server/client for RabbitMQ:

```javascript
const amqplib = require('ampqlib');
const {AMQPRPCServer, AMQPRPCClient} = require('@elasic.io/amqp-rpc');
const exchange = 'EXCHANGE';
const key = 'KEY';

async function init() {
  const connection = await amqplib.connect('amqp://localhost');
  const server = new AMQPRPCServer(connection, exchange, key);
  const client = new AMQPRPCClient(connection, exchange, key);
  
  await server.start();
  
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
