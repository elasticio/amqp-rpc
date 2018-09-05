'use strict';

const sinon = require('sinon');
const {expect} = require('chai');

const {AMQPRPCClient} = require('../../');
const Command = require('../../src/Command');

describe('AMQPRPCClient', () => {
  let channelStub;
  let connectionStub;

  beforeEach(() => {
    channelStub = {
      ack: sinon.stub().returns(Promise.resolve()),
      assertQueue: sinon.stub().returns(Promise.resolve({})),
      cancel: sinon.stub().returns(Promise.resolve()),
      close: sinon.stub().returns(Promise.resolve()),
      consume: sinon.stub().returns(Promise.resolve({consumerTag: (Math.random() * 1000 | 0).toString(16)})),
      deleteQueue: sinon.stub().returns(Promise.resolve()),
      sendToQueue: sinon.stub().returns(Promise.resolve())
    };
    connectionStub = {
      createChannel: sinon.stub().returns(Promise.resolve(channelStub))
    };
  });


  describe('#contructor', () => {
    it('should throw when params.requestsQueue is omitted', () => {

      expect(() => new AMQPRPCClient(connectionStub, {})).to.throw('params.requestsQueue is required');
    });
    it('should consider params.repliesQueue', () => {
      const repliesQueue = 'replies';
      const client = new AMQPRPCClient(connectionStub, {repliesQueue, requestsQueue: 'q'});
      expect(client.repliesQueue).to.equal(repliesQueue);
    });
    it('should consider params.timeout', () => {
      const timeout = 57;
      const client = new AMQPRPCClient(connectionStub, {timeout, requestsQueue: 'q'});
      expect(client._params.timeout).to.equal(timeout);
    });
  });

  describe('#sendCommand', () => {
    let client;

    beforeEach(async () => {
      client = new AMQPRPCClient(connectionStub, {
        requestsQueue: 'q',
        repliesQueue: 'r',
        defaultMessageOptions: {
          userId: 'john.doe'
        }
      });
      await client.start();
    });

    it('should call sendToQueue when called with name only', () => {
      client.sendCommand('test');

      expect(channelStub.sendToQueue).to.have.been.calledOnce.and
        .calledWith('q',
          new Command('test').pack(),
          { correlationId: "0", replyTo: "r", userId: 'john.doe' }
        );
    });

    it('should call sendToQueue when called with name and args', () => {
      client.sendCommand('test', [1, 'foo']);

      expect(channelStub.sendToQueue).to.have.been.calledOnce.and
        .calledWith('q',
          new Command('test', [1, 'foo']).pack(),
          { correlationId: "0", replyTo: "r", userId: 'john.doe' }
        );
    });

    it('should call sendToQueue when called with name, args and messageOptions', async () => {
      client.sendCommand('test', [1, 'foo'], { persistent: false });

      expect(channelStub.sendToQueue).to.have.been.calledOnce.and
        .calledWith('q',
          new Command('test', [1, 'foo']).pack(),
          { correlationId: "0", replyTo: "r", persistent: false, userId: 'john.doe' }
        );
    });

  });


  describe('#start', () => {

    it('should create amqp channel for work', async () => {
      const client = new AMQPRPCClient(connectionStub, {requestsQueue: 'q'});
      await client.start();
      expect(connectionStub.createChannel).to.have.been.calledOnce;
      expect(client._channel).to.equal(channelStub);
    });

    it('should create generated amqp queue with options', async () => {
      const client = new AMQPRPCClient(connectionStub, {requestsQueue: 'q'});
      const queueStub = {
        queue: 'q1'
      };
      channelStub.assertQueue = sinon.stub().returns(Promise.resolve(queueStub));
      await client.start();
      expect(channelStub.assertQueue).to.have.been.calledOnce
        .and.calledWith('', {
        exclusive: true
      });
      expect(client.repliesQueue).to.equal(queueStub.queue);
    });

    it('should skip creating queue when params.queueName is set', async () => {
      const repliesQueue = 'qq';
      const client = new AMQPRPCClient(connectionStub, {repliesQueue, requestsQueue: 'q'});
      await client.start();
      expect(channelStub.assertQueue).not.to.be.called;
      expect(client.repliesQueue).to.equal(repliesQueue);
    });

    it('should start listening from queue', async () => {
      const client = new AMQPRPCClient(connectionStub, {requestsQueue: 'q'});
      let consumerMethod;
      channelStub.consume = (queueName, cb) => {
        consumerMethod = cb;
        return {
          consumerTag: (Math.random() * 1000 | 0).toString(16)
        };
      };
      sinon.spy(channelStub, 'consume');
      client._dispatchReply = sinon.stub();
      await client.start();
      expect(channelStub.consume).to.have.been.calledOnce
        .and.calledWith(client.queueName, consumerMethod);

      const msg = {};
      consumerMethod(msg);
      expect(client._dispatchReply).to.have.been.calledOnce
        .and.calledWith(msg);
    });
  });


  describe('#disconnect', () => {

    it('should delete queue if it was created by client', async () => {
      const client = new AMQPRPCClient(connectionStub, {requestsQueue: 'q'});
      await client.start();
      const repliesQueue = client.repliesQueue;
      await client.disconnect();
      expect(channelStub.deleteQueue).to.have.been.calledOnce
        .and.calledWith(repliesQueue);
    });

    it('should not delete queue if params.repliesQueue is set', async () => {
      const client = new AMQPRPCClient(connectionStub, {repliesQueue: 'replies', requestsQueue: 'q'});
      await client.start();
      await client.disconnect();
      expect(channelStub.deleteQueue).not.to.be.called;
    });


    it('should cancel subscription', async () => {
      const repliesQueue = 'qw';
      const consumerTag = 'b-52';
      channelStub.consume = sinon.stub().returns(Promise.resolve({consumerTag}));
      const server = new AMQPRPCClient(connectionStub, {repliesQueue, requestsQueue: 'q'});
      await server.start();
      await server.disconnect();
      expect(channelStub.cancel).to.have.been.calledOnce
        .and.calledWith(consumerTag);
    });

    it('should close channel', async () => {
      const client = new AMQPRPCClient(connectionStub, {requestsQueue: 'q'});
      await client.start();
      await client.disconnect();
      expect(channelStub.close).to.have.been.calledOnce;
    });

    it('should clear _requests map', async () => {
      const client = new AMQPRPCClient(connectionStub, {requestsQueue: 'q'});
      await client.start();
      setTimeout(() => {
        client.disconnect()
      }, 50);

      const requestCountBefore = Array.from(client._requests.entries()).length;
      expect(requestCountBefore).to.equal(0);
      try {
        const promise = client.sendCommand('cmd');

        const requestCountWhile = Array.from(client._requests.entries()).length;
        expect(requestCountWhile).to.equal(1);

        await promise;
      } catch (e) {
        if (e.message.indexOf('canceled due to client disconnect') === -1) {
          //this is another error than expected, so it's time to harakiri
          throw e;
        }
      }
      setImmediate(() => {
        const requestCountAfter = Array.from(client._requests.entries()).length;
        expect(requestCountAfter).to.equal(0);
      });
    });
  });
});
