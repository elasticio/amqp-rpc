const helpers = require('../helpers.js');
const {assert} = require('chai');
const {AMQPRPCClient} = require('../..');

describe('AMQPRPCClient', () => {
  it('Should handle timeouts', async () => {
    const exchange = 'exchange-' + String(Date.now()) + Math.random();
    const key = 'key-' + String(Date.now()) + Math.random();
    const connection = await helpers.getAmqpConnection();
    const proxy = new AMQPRPCClient(connection, exchange, key, {timeout: 300});

    try {
      await proxy.sendCommand('just-a-command', ['arg1', 'arg2']);
    } catch (e) {
      assert.instanceOf(e, Error);
      assert.equal(e.toString(), 'Error: Timeout');
    } finally {
      await helpers.closeAmqpConnection();
    }
  });
});
