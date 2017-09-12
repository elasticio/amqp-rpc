const amqp = require('amqplib');
const {assert} = require('chai');
const {AMQPRPCClient} = require('../..');

const AMQP_URI = 'amqp://localhost';

describe('AMQPRPCClient', () => {
  it('Should handle timeouts', async () => {
    const exchange = 'exchange-' + String(Date.now()) + Math.random();
    const key = 'key-' + String(Date.now()) + Math.random();
    const connection = await amqp.connect(AMQP_URI);
    const proxy = new AMQPRPCClient(connection, exchange, key, {timeout: 300});

    try {
      await proxy.sendCommand('just-a-command', ['arg1', 'arg2']);
    } catch (e) {
      assert.instanceOf(e, Error);
      assert.equal(e.toString(), 'Error: Timeout');
    } finally {
      await connection.close();
    }
  });
});
