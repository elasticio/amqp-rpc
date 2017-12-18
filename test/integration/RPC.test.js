'use strict';


const fakeRpcTransport = require('./helpers/FakeRpcTransport')
const RPCClient = require('../../src/RPCClient')
const RPCServer = require('../../src/RPCServer')


const sinon = require('sinon');
const chai = require('chai');
const chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);
const {expect} = chai;

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

describe('RPC Client-Server with FakeConnection', () => {
  let server;
  let client;
  before(async () => {

    ({server, client} = await fakeRpcTransport.init('my-rpc'));
    // const id = ;
    // const commands = new FakeConnection();
    // const replies = new FakeConnection();
    // client = new RPCClient(id, {
    //   incomingConnection: replies,
    //   outgoingConnection: commands,
    // });
    // server = new RPCServer(id, {
    //   incomingConnection: commands,
    //   outgoingConnection: replies,
    // });
    // await server.start();
    // await client.start();
  });

  after(() => {
    client.close();
    server.close();
  });

  describe('when command has assigned handler on server', () => {
    it('should invoke command handler on server side', async () => {
      const commandStub = sinon.stub();

      server.addCommand('command', commandStub);
      await client.sendCommand('command');

      expect(commandStub).to.have.been.calledOnce
        .and.calledWith();
    });
    it('should pass arguments from client call to server', async () => {
      const commandStub = sinon.stub();
      const args = [
        'string argument',
        {key: 'value'},
        [1, 2, 3],
        Math.PI,
        false,
        // undefined, //FIXME (sometime in the future)
        24,
        // new Date() //FIXME (sometime in the future)
      ];

      server.addCommand('command', commandStub);
      await client.sendCommand('command', args);

      expect(commandStub).to.have.callCount(1);
      expect(commandStub).to.have.callCount(1);
      expect(commandStub.getCall(0).args).to.deep.equal(args);
    });
  });
  describe('when command does not have assigned handler on server', () => {
    //@todo how about timeout handling on clients side?
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
});

