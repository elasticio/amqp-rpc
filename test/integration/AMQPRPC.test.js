const sinon = require('sinon');
const {assert} = require('chai');

const helpers = require('../helpers.js');

const {AMQPRPCClient, AMQPRPCServer} = require('../..');

//@todo add test for options.queueNamePrefix
//@todo add test for options.queue
//@todo add test for server.start(skipAssert = false)
describe('AMQPRPCClient to AMQPRPCServer', () => {
  let connection;
  let client;
  let server;

  beforeEach(async () => {
    const exchange = 'exchange-' + String(Date.now()) + Math.random();
    const key = 'key-' + String(Date.now()) + Math.random();

    connection = await helpers.getAmqpConnection();
    client = new AMQPRPCClient(connection, { exchange, key });
    server = new AMQPRPCServer(connection, { exchange, key });

    await server.start();
  });

  afterEach(async () => {
    await server.disconnect();
    await helpers.closeAmqpConnection();
  });

  it('Should bypass arguments from client call to server', async () => {
    const commandStub = sinon.stub();
    const args = ['string argument', {key: 'value'}, [1, 2, 3]];

    server.addCommand('command', commandStub);
    await client.sendCommand('command', args);

    assert.ok(commandStub.calledOnce);
    assert.deepEqual(commandStub.getCall(0).args, args);
  });

  it('Should bypass execution result from server to client call', async () => {
    const args = ['string argument', {key: 'value'}, [1, 2, 3]];
    const result = {key: 'value', arrayKey: [1, 2, 3]};
    const commandStub = sinon.spy(() => result);

    server.addCommand('command', commandStub);

    assert.deepEqual(await client.sendCommand('command', args), result);
    assert.ok(commandStub.calledOnce);
    assert.ok(commandStub.getCall(0).args, args);
  });

  it('Should bypass error thrown from server to client call', async () => {
    const E_CUSTOM_ERROR_CODE = 'E_CUSTOM_ERROR_CODE';
    server.addCommand('errorCommand', () => {
      const e = new Error('ERROR');
      e.code = E_CUSTOM_ERROR_CODE;
      throw e;
    });

    try {
      await client.sendCommand('errorCommand', []);
    } catch (e) {
      assert.instanceOf(e, Error);
      assert.equal(e.toString(), 'Error: ERROR');
      assert.equal(e.code, E_CUSTOM_ERROR_CODE);
    }
  });
});

describe('AMQPRPCClient', () => {
  it('Should handle timeouts', async () => {
    const exchange = 'exchange-' + String(Date.now()) + Math.random();
    const key = 'key-' + String(Date.now()) + Math.random();
    const connection = await helpers.getAmqpConnection();
    const proxy = new AMQPRPCClient(connection, { exchange, key, timeout: 300 });

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
