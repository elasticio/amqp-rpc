'use strict';

const assert = require('assert');
const EventEmitter = require('events');

const sinon = require('sinon');
const {expect} = require('chai');

const {AMQPEventsReceiver} = require('../../');

describe('AMQPEventsReceiver', () => {
  let channelStub;
  let connectionStub;

  beforeEach(() => {
    channelStub = {
      assertQueue: sinon.stub().returns(Promise.resolve({})),
      consume: sinon.stub().returns(Promise.resolve()),
      ack: sinon.stub().returns(Promise.resolve()),
      close: sinon.stub().returns(Promise.resolve()),
      deleteQueue: sinon.stub().returns(Promise.resolve())
    };
    connectionStub = {
      createChannel: sinon.stub().returns(Promise.resolve(channelStub))
    };
  });


  describe('#contructor', () => {

    it('should be event emitter', () => {
      const receiver = new AMQPEventsReceiver(connectionStub);
      expect(receiver).to.be.instanceof(EventEmitter);
    });

    it('should set connection', () => {
      const receiver = new AMQPEventsReceiver(connectionStub);
      expect(receiver._connection).to.equal(connectionStub);
    });

    it('should consider queueName', () => {
      const queueName = 'q';
      const receiver = new AMQPEventsReceiver(connectionStub, {queueName});
      expect(receiver._queueName).to.equal(queueName);
    });
  });


  describe('#start', () => {

    it('should throw if already started', async () => {
      const receiver = new AMQPEventsReceiver(connectionStub);
      await receiver.start();
      let caughtError;
      try {
        await receiver.start();
      } catch (e) {
        caughtError = e;
      }
      expect(caughtError).instanceof(assert.AssertionError);
      expect(caughtError.message).to.equal('Already started');
    });

    it('should create amqp channel for work', async () => {
      const receiver = new AMQPEventsReceiver(connectionStub);
      await receiver.start();
      expect(connectionStub.createChannel).to.have.been.calledOnce;
      expect(receiver._channel).to.equal(channelStub);
    });

    it('should create generated amqp queue with options', async () => {
      const receiver = new AMQPEventsReceiver(connectionStub);
      const queueStub = {
        queue: 'q1'
      };
      channelStub.assertQueue = sinon.stub().returns(Promise.resolve(queueStub));
      await receiver.start();
      expect(channelStub.assertQueue).to.have.been.calledOnce
        .and.calledWith('', {
        exclusive: true
      });
      expect(receiver._queueName).to.equal(queueStub.queue);
      expect(receiver.queueName).to.equal(queueStub.queue);
    });

    it('should skip creating queue when params.queueName is set', async () => {
      const queueName = 'qq';
      const receiver = new AMQPEventsReceiver(connectionStub, {queueName});
      await receiver.start();
      expect(channelStub.assertQueue).not.to.be.called;
      expect(receiver.queueName).to.equal(queueName);
      expect(receiver._queueName).to.equal(queueName);
    });

    it('should start listening from queue', async () => {
      const receiver = new AMQPEventsReceiver(connectionStub);
      let consumerMethod;
      channelStub.consume = (queueName, cb) => {
        consumerMethod = cb;
      };
      sinon.spy(channelStub, 'consume');
      receiver._handleMessage = sinon.stub();
      await receiver.start();
      expect(channelStub.consume).to.have.been.calledOnce
        .and.calledWith(receiver.queueName, consumerMethod);

      const msg = {};
      consumerMethod(msg);
      expect(receiver._handleMessage).to.have.been.calledOnce
        .and.calledWith(msg);
    });
  });


  describe('#_handleMessage', () => {

    it('should emit received messages as data events', async () => {
      const receiver = new AMQPEventsReceiver(connectionStub);
      await receiver.start();
      const data = {
        key: 'value'
      };
      const msg = {
        content: new Buffer(JSON.stringify(data))
      };
      const dataEventHandler = sinon.stub();
      receiver.on('data', dataEventHandler);
      receiver._handleMessage(msg);
      expect(dataEventHandler).to.have.been.calledOnce
        .and.calledWith(data);
    });

    it('should emit ack received messages', async () => {
      const receiver = new AMQPEventsReceiver(connectionStub);
      await receiver.start();
      const data = {
        key: 'value'
      };
      const msg = {
        content: new Buffer(JSON.stringify(data))
      };
      receiver._handleMessage(msg);
      expect(channelStub.ack).to.have.been.calledOnce
        .and.calledWith(msg);
    });

    it('should emit end on queue removal', async () => {
      const receiver = new AMQPEventsReceiver(connectionStub);
      await receiver.start();
      const endEventHandler = sinon.stub();
      receiver.on('end', endEventHandler);
      receiver._handleMessage(null);
      expect(endEventHandler).to.have.been.calledOnce;
    });

    it('should disconnect on queue removal', async () => {
      const receiver = new AMQPEventsReceiver(connectionStub);
      await receiver.start();
      receiver.disconnect = sinon.stub();
      receiver._handleMessage(null);
      expect(receiver.disconnect).to.have.been.calledOnce;
    });
  });


  describe('#disconnect', () => {

    it('should emit close event', async () => {
      const receiver = new AMQPEventsReceiver(connectionStub);
      await receiver.start();
      const closeEventHandler = sinon.stub();
      receiver.on('close', closeEventHandler);
      await receiver.disconnect();
      expect(closeEventHandler).to.have.been.calledOnce;
    });

    it('should do nothing if not listening', async () => {
      const receiver = new AMQPEventsReceiver(connectionStub);
      await receiver.disconnect();
      expect(channelStub.deleteQueue).not.to.be.called;
      expect(channelStub.close).not.to.be.called;
    });

    it('should delete queue if it was created by receiver', async () => {
      const receiver = new AMQPEventsReceiver(connectionStub);
      await receiver.start();
      await receiver.disconnect();
      expect(channelStub.deleteQueue).to.have.been.calledOnce
        .and.calledWith(receiver.queueName);
    });

    it('should not delete queue if params.queueName is set', async () => {
      const receiver = new AMQPEventsReceiver(connectionStub, {queueName: 'qqqq'});
      await receiver.start();
      await receiver.disconnect();
      expect(channelStub.deleteQueue).not.to.be.called;
    });

    it('should not fail if trying to delete non existent queue', async () => {
      const receiver = new AMQPEventsReceiver(connectionStub);
      await receiver.start();
      channelStub.deleteQueue = sinon.stub().returns(Promise.reject(new Error('there are no queue')));
      await receiver.disconnect();
      expect(channelStub.deleteQueue).to.have.been.calledOnce
        .and.calledWith(receiver.queueName);
      expect(channelStub.close).to.have.been.calledOnce;
    });

    it('should close channel', async () => {
      const receiver = new AMQPEventsReceiver(connectionStub);
      await receiver.start();
      await receiver.disconnect();
      expect(channelStub.close).to.have.been.calledOnce;
    });
  });
});
