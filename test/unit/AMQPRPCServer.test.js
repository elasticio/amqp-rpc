'use strict';

const sinon = require('sinon');
const {expect} = require('chai');

const {AMQPRPCServer} = require('../../');

describe('AMQPRPCServer', () => {
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
    it('should consider params.requestsQueue', () => {
      const requestsQueue = 'q';
      const server = new AMQPRPCServer(connectionStub, {requestsQueue});
      expect(server.requestsQueue).to.equal(requestsQueue);
    });
  });


  describe('#start', () => {

    it('should create amqp channel for work', async () => {
      const server = new AMQPRPCServer(connectionStub);
      await server.start();
      expect(connectionStub.createChannel).to.have.been.calledOnce;
      expect(server._channel).to.equal(channelStub);
    });

    it('should create generated amqp queue with options', async () => {
      const server = new AMQPRPCServer(connectionStub);
      const queueStub = {
        queue: 'q1'
      };
      channelStub.assertQueue = sinon.stub().returns(Promise.resolve(queueStub));
      await server.start();
      expect(channelStub.assertQueue).to.have.been.calledOnce
        .and.calledWith('', {
        exclusive: true
      });
      expect(server.requestsQueue).to.equal(queueStub.queue);
    });

    it('should skip creating queue when params.queueName is set', async () => {
      const requestsQueue = 'qq';
      const server = new AMQPRPCServer(connectionStub, {requestsQueue});
      await server.start();
      expect(channelStub.assertQueue).not.to.be.called;
      expect(server.requestsQueue).to.equal(requestsQueue);
    });

    it('should start listening from queue', async () => {
      const server = new AMQPRPCServer(connectionStub);
      let consumerMethod;
      channelStub.consume = (queueName, cb) => {
        consumerMethod = cb;
        return {
          consumerTag: (Math.random() * 1000 | 0).toString(16)
        };
      };
      sinon.spy(channelStub, 'consume');
      server._handleMsg = sinon.stub();
      await server.start();
      expect(channelStub.consume).to.have.been.calledOnce
        .and.calledWith(server.queueName, consumerMethod);

      const msg = {};
      consumerMethod(msg);
      expect(server._handleMsg).to.have.been.calledOnce
        .and.calledWith(msg);
    });
  });


  describe('#disconnect', () => {

    it('should delete queue if it was created by server', async () => {
      const server = new AMQPRPCServer(connectionStub);
      await server.start();
      const requestsQueue = server.requestsQueue;
      await server.disconnect();
      expect(channelStub.deleteQueue).to.have.been.calledOnce
        .and.calledWith(requestsQueue);
    });

    it('should not delete queue if params.repliesQueue is set', async () => {
      const server = new AMQPRPCServer(connectionStub, {requestsQueue: 'qqqq'});
      await server.start();
      await server.disconnect();
      expect(channelStub.deleteQueue).not.to.be.called;
    });

    it('should cancel subscription', async () => {
      const requestsQueue = 'q4';
      const consumerTag = 'b-17';
      channelStub.consume = sinon.stub().returns(Promise.resolve({consumerTag}));
      const server = new AMQPRPCServer(connectionStub, {requestsQueue});
      await server.start();
      await server.disconnect();
      expect(channelStub.cancel).to.have.been.calledOnce
        .and.calledWith(consumerTag);
    });

    it('should close channel', async () => {
      const server = new AMQPRPCServer(connectionStub);
      await server.start();
      await server.disconnect();
      expect(channelStub.close).to.have.been.calledOnce;
    });
  });
});
