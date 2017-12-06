const {expect} = require('chai');
const sinon = require('sinon');
const {AMQPRPCClient} = require('../..');

function getFake() {
  function rndStr() {
    return (Math.random() * 10000 | 0).toString(16);
  }

  let queueName;


  const fakeChannel = {
    assertExchange: sinon.stub().callsFake(() => Promise.resolve({})),
    assertQueue: sinon.stub().callsFake((queue) => {
      queueName = queue || rndStr();
      return Promise.resolve({queue: queueName})
    }),
    consume: sinon.stub().callsFake((queue, callback) => {
      const deliveryTag = rndStr();
      setTimeout(() => {
        const content = Buffer.from(JSON.stringify({state: 'success'}));
        callback({content});
      }, 50);
      return Promise.resolve({deliveryTag});
    }),
    cancel: sinon.stub().callsFake(() => Promise.resolve()),
    deleteQueue:
      sinon.stub().callsFake(() => Promise.resolve()),
    publish:
      sinon.stub().callsFake(() => Promise.resolve()),
  };

  const fakeConnection = {
    createChannel: () => Promise.resolve(fakeChannel)
  };

  return {fakeChannel, fakeConnection, queueName};
}

describe('AMQPRPCClient', () => {
  describe('when options.queueNamePrefix is omitted', () => {
    it.skip('Should use auto-generated queue', async () => {
      const exchange = 'exchange-' + String(Date.now()) + Math.random();
      const key = 'key-' + String(Date.now()) + Math.random();
      const {fakeChannel, fakeConnection, queueName} = getFake();

      const client = new AMQPRPCClient(fakeConnection, {exchange, key});

      await client.sendCommand('just-a-command', ['arg1', 'arg2']);

      expect(fakeChannel.assertQueue).callCount(1);
      expect(fakeChannel.assertQueue).calledWith('');

      expect(fakeChannel.assertExchange).callCount(1);
      expect(fakeChannel.assertExchange).calledWith(exchange, 'direct');

      expect(fakeChannel.consume).callCount(1);
      expect(fakeChannel.consume).calledWith(queueName);

      expect(fakeChannel.publish).callCount(1);
      expect(fakeChannel.publish).calledWith(exchange, JSON.stringify({}));
    });
  });
});
