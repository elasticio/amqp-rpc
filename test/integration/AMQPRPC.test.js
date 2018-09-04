'use strict';

const sinon = require('sinon');
const chai = require('chai');
const chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);
const {expect} = chai;

const {AMQPRPCClient, AMQPRPCServer} = require('../..');
const helpers = require('../helpers.js');

const E_CUSTOM_ERROR_CODE = 'E_CUSTOM_ERROR_CODE';

function getResultExample() {
  return {
    str: 'string argument',
    obj: {
      key: 'value'
    },
    // , //FIXME (sometime in the future)
    arr: [1, 2, 3],
    float: Math.PI,
    boolean: false,
    // undefined: void(0), //FIXME (sometime in the future)
    int: 24,
    // date: new Date('2010-09-08T07:06:05.432Z') //FIXME (sometime in the future)
  };
}

describe('AMQPRPCClient to AMQPRPCServer', () => {
  let connection;
  let client;
  let server;

  beforeEach(async () => {
    connection = await helpers.getAmqpConnection();
    server = new AMQPRPCServer(connection);
    await server.start();
    client = new AMQPRPCClient(connection, {requestsQueue: server.requestsQueue, timeout: 200 });
    await client.start();
  });

  afterEach(async () => {
    await server.disconnect();
    await client.disconnect();
    await helpers.closeAmqpConnection();
  });

  describe('when command has assigned handler on server', () => {
    it('should invoke command handler on server side', async () => {
      const commandStub = sinon.stub();

      server.addCommand('command', commandStub);
      await client.sendCommand('command');

      expect(commandStub).to.have.callCount(1);
      expect(commandStub.getCall(0).args).to.deep.equal([]);
    });
    it('should delete timedout requests from map', async () => {
      server.addCommand('command', () => new Promise(sinon.stub()));
      await expect(client.sendCommand('command')).to.be.rejectedWith(Error);
      expect(client._requests.size).to.equal(0);
    });
    it('should pass arguments from client call to server', async () => {
      const commandStub = sinon.stub();
      const args = [
        'string argument',
        {key: 'value'},
        [1, 2, 3],
        Math.PI,
        false,
        // undefined, //not implemented
        24,
        // new Date()  //not implemented
      ];

      server.addCommand('command', commandStub);
      await client.sendCommand('command', args);

      expect(commandStub).to.have.callCount(1);
      expect(commandStub.getCall(0).args).to.deep.equal(args);
    });
  });
  describe('when command does not have assigned handler on server', () => {
    it('should return rejection to client caller', async () => {
      const commandStub = sinon.stub();

      server.addCommand('command', commandStub);

      await expect(client.sendCommand(`cmd-${Math.random()}`))
        .to.be.rejectedWith(Error);

      expect(commandStub).to.have.callCount(0);
    });
  });
  describe('when command is a sync function', () => {
    it('should pass execution result from server to client call', async () => {
      server.addCommand('command', getResultExample);

      const actualResult = await client.sendCommand('command');
      expect(actualResult).to.deep.equal(getResultExample());
    });
  });
  describe('when command returns a promise', () => {
    it('should pass value of resolved promise to client call', async () => {

      server.addCommand('command', () => new Promise((resolve) => {
        setTimeout(() => resolve(getResultExample()), 10);
      }));

      const actualResult = await client.sendCommand('command');
      expect(actualResult).to.deep.equal(getResultExample());
    });
  });
  describe('when command throws an error', () => {
    it('should return rejection to client caller', async () => {
      server.addCommand('command', () => new Promise((resolve, reject) => {
        const e = new Error();
        e.code = E_CUSTOM_ERROR_CODE;
        setTimeout(() => reject(e), 10);
      }));

      await expect(client.sendCommand('command'))
        .to.be.rejectedWith(Error)
        .and.eventually.have.property('code', E_CUSTOM_ERROR_CODE);
    });
  });
  describe('when command returns rejected promise', () => {
    it('should return rejection to client caller', async () => {

      server.addCommand('command', () => {
        const e = new Error();
        e.code = E_CUSTOM_ERROR_CODE;
        throw e;
      });

      await expect(client.sendCommand('command'))
        .to.be.rejectedWith(Error)
        .and.eventually.have.property('code', E_CUSTOM_ERROR_CODE);
    });
  });

  describe('AMQPRPCClient', () => {
    it('Should handle timeouts', async () => {
      const client = new AMQPRPCClient(connection, {timeout: 300, requestsQueue: 'tmp-queue-1'});
      await client.start();

      const expectedMessage = 'sendCommand canceled due to timeout (300), command:test-timeout, correlationId:0';
      await expect(client.sendCommand('test-timeout'))
        .to.be.rejectedWith(Error)
        .and.eventually.have.property('message', expectedMessage);
      await client.disconnect();
    });

    it('Should reject all requests in flight on disconnecting', async () => {
      const client = new AMQPRPCClient(connection, {requestsQueue: 'tmp-queue-2'});
      await client.start();

      setTimeout(() => {
        client.disconnect();
      }, 50);

      const promise1 = client.sendCommand('test-disconnect');
      const promise2 = client.sendCommand('test-disconnect-2', [1, 2, false]);

      await expect(promise1)
        .to.be.rejectedWith(Error)
        .and.eventually.have.property('message',
          'sendCommand canceled due to client disconnect, command:test-disconnect, correlationId:0');

      await expect(promise2)
        .to.be.rejectedWith(Error)
        .and.eventually.have.property('message',
          'sendCommand canceled due to client disconnect, command:test-disconnect-2, correlationId:1');
    });
  });
});
