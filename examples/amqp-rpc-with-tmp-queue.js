/* eslint-disable no-console  */
/* eslint-disable import/no-extraneous-dependencies */

const amqplib = require('amqplib');
const {AMQPRPCClient, AMQPRPCServer} = require('..');


function delay(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  })
}

/**
 *
 * @return {Promise<String>} queueName when server listens on for requests
 */
async function initServer() {
  console.log('Server starting');
  const connection = await amqplib.connect('amqp://localhost');
  const server = new AMQPRPCServer(connection);

  server.addCommand('hello', (name) => ({message: `Hello, ${name}!`}));

  server.addCommand('get-time', () => ({time: new Date()}));

  await server.start();
  console.log('Server is ready');
  return server.requestsQueue;
}

/**
 *
 * @param requestsQueue
 * @return {Promise<void>}
 */
async function initClient1(requestsQueue) {
  console.log('Tom starting');
  const connection = await amqplib.connect('amqp://localhost');
  const client = new AMQPRPCClient(connection, {requestsQueue});
  await client.start();

  const response1 = await client.sendCommand('hello', ['Tom']);
  console.log(`Tom got hello response ${response1.message}`);

  await delay(100);

  const response2 = await client.sendCommand('get-time', []);
  console.log(`Tom got 1st response for get-time: ${response2.time}`);

  await delay(100);

  const response3 = await client.sendCommand('get-time', []);
  console.log(`Tom got 2nd response for get-time: ${response3.time}`);
}

async function initClient2(requestsQueue) {
  console.log('Alisa starting');
  const connection = await amqplib.connect('amqp://localhost');
  const client = new AMQPRPCClient(connection, {requestsQueue});
  await client.start();

  const response1 = await client.sendCommand('hello', ['Alisa']);
  console.log(`Alisa got hello response ${response1.message}`);

  await delay(150);

  const response2 = await client.sendCommand('get-time', []);
  console.log(`Alisa got response for get-time: ${response2.time}`);
}


(async function main() {
  console.info('\n launch server:\n');
  const tmpQueueName = await initServer();

  console.info('\n launch clients:\n');
  await Promise.all([
    initClient1(tmpQueueName),
    initClient2(tmpQueueName)
  ]);
})().catch(console.error.bind(console, 'General error:'));

