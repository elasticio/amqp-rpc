const sinon = require('sinon');
const {assert} = require('chai');

const helpers = require('../helpers.js');

const {AMQPRPCClient, AMQPRPCServer} = require('../..');

describe('AMQPRPCClient to AMQPRPCServer', () => {
  let connection;
  let proxy;
  let agent;

  beforeEach(async () => {
    const exchange = 'exchange-' + String(Date.now()) + Math.random();
    const key = 'key-' + String(Date.now()) + Math.random();

    connection = await helpers.getAmqpConnection();
    proxy = new AMQPRPCClient(connection, exchange, key);
    agent = new AMQPRPCServer(connection, exchange, key);

    await agent.start();
  });

  afterEach(async () => {
    await agent.disconnect();
    await helpers.closeAmqpConnection();
  });

  it('Should bypass arguments from proxy call to agent', async () => {
    const commandStub = sinon.stub();
    const args = ['string argument', {key: 'value'}, [1, 2, 3]];

    agent.addCommand('command', commandStub);
    await proxy.sendCommand('command', args);

    assert.ok(commandStub.calledOnce);
    assert.deepEqual(commandStub.getCall(0).args, args);
  });

  it('Should bypass execution result from agent to proxy call', async () => {
    const args = ['string argument', {key: 'value'}, [1, 2, 3]];
    const result = {key: 'value', arrayKey: [1, 2, 3]};
    const commandStub = sinon.spy(() => result);

    agent.addCommand('command', commandStub);

    assert.deepEqual(await proxy.sendCommand('command', args), result);
    assert.ok(commandStub.calledOnce);
    assert.ok(commandStub.getCall(0).args, args);
  });

  it('Should bypass error thrown from agent to proxy call', async () => {
    agent.addCommand('errorCommand', () => {
      throw new Error('ERROR');
    });

    try {
      await proxy.sendCommand('errorCommand', []);
    } catch (e) {
      assert.instanceOf(e, Error);
      assert.equal(e.toString(), 'Error: ERROR');
    }
  });
});
