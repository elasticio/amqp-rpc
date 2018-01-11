'use strict'

const EventEmitter = require('events');

const sinon = require('sinon');
const chai = require('chai');
const {expect} = chai;

const {AMQPEventsSender} = require('../../');

describe('AMQPEventsSender', () => {
  let channelStub;
  let connectionStub;
  let queueName;

  beforeEach(() => {
    queueName = String(Math.random()) + Date.now();
    channelStub = {
      assertQueue: sinon.stub().returns(Promise.resolve({})),
      consume: sinon.stub().returns(Promise.resolve()),
      ack: sinon.stub().returns(Promise.resolve()),
      close: sinon.stub().returns(Promise.resolve()),
      deleteQueue: sinon.stub().returns(Promise.resolve()),
      sendToQueue: sinon.stub().returns(Promise.resolve()),
      // on: sinon.stub().returns(channelStub) //I'm wondering why this doesn't work, workaround is below
      on: sinon.stub().callsFake(() => channelStub)
    };
    connectionStub = {
      createChannel: sinon.stub().returns(Promise.resolve(channelStub))
    };
  });


  it('should be constructable', () => {
    const sender = new AMQPEventsSender(connectionStub, {queueName});
    expect(sender).to.be.instanceof(EventEmitter);
    expect(sender).to.be.instanceof(AMQPEventsSender);
    expect(sender._connection).to.equal(connectionStub);
    expect(sender._queueName).to.equal(queueName);
    expect(sender._channel).to.be.equal(null);
  });


  describe('#send', () => {
    it('should send packed message to queue with mandatory flag', async () => {
      const sender = new AMQPEventsSender(connectionStub, {queueName});
      await sender.start();

      expect(channelStub.sendToQueue).not.to.have.been.called;
      const data = {
        key: 'value',
        arr: [1, 2, 3]
      };
      await sender.send(data);
      expect(channelStub.sendToQueue).to.have.been.calledOnce
        .and.calledWith(queueName, new Buffer(JSON.stringify(data)), {
        mandatory: true,
        expiration: 600000
      });
    });

    it('should send packed message to specified exchange and queue', async () => {
      const exchangeName = String(Math.random()) + Date.now();
      const sender = new AMQPEventsSender(connectionStub, {queueName, exchangeName});
      await sender.start();
      expect(channelStub.sendToQueue).not.to.have.been.called;
      const data = {
        key: 'value',
        arr: [1, 2, 3]
      };
      await sender.send(data);
      expect(channelStub.sendToQueue).to.have.been.calledOnce
        .and.calledWith(queueName, new Buffer(JSON.stringify(data)), {
        mandatory: true,
        expiration: 600000
      });
    });

    it('should emit error, if sending failed', async () => {
      const sender = new AMQPEventsSender(connectionStub, {queueName});
      await sender.start();
      const data = {
        key: 'value',
        arr: [1, 2, 3]
      };
      const error = new Error('bla-bla-bla');
      channelStub.sendToQueue = sinon.stub().returns(Promise.reject(error));
      const errorHandler = sinon.stub();
      sender.on('error', errorHandler);
      await sender.send(data);
      expect(errorHandler).to.have.been.calledOnce
        .and.calledWith(error);
    });
  });


  describe('#_start', () => {

    it('should create amqp channel', async () => {
      const sender = new AMQPEventsSender(connectionStub, {queueName});
      await sender.start();
      expect(connectionStub.createChannel).to.have.been.calledOnce;
    });

    it('should create subscribe channel events', async () => {
      const sender = new AMQPEventsSender(connectionStub, {queueName});
      sinon.stub(sender, '_subscribeToChannel');
      await sender.start();
      expect(sender._subscribeToChannel).to.have.been.calledOnce
        .and.calledWith();
    });

    it('should emit error, if channel creation failed', async () => {
      const sender = new AMQPEventsSender(connectionStub, {queueName});
      const error = new Error('can\'t create channel');
      connectionStub.createChannel = sinon.stub().returns(Promise.reject(error));
      const errorHandler = sinon.stub();
      sender.on('error', errorHandler);
      try {
        await sender.start();
      } catch (e) {
        //in real code this should be procesed
      }
      expect(errorHandler).to.have.been.calledOnce
        .and.calledWith(error);
    });

    it('should be caching and does not create channel if it exists', async () => {
      const sender = new AMQPEventsSender(connectionStub, {queueName});
      sinon.stub(sender, '_subscribeToChannel');
      await sender.start();
      const channel = sender._channel;
      expect(connectionStub.createChannel).to.have.been.calledOnce;
      expect(sender._subscribeToChannel).to.have.been.calledOnce
        .and.calledWith();
      await sender.start();
      const secondCallResult = sender._channel;
      expect(connectionStub.createChannel).to.have.been.calledOnce;
      expect(sender._subscribeToChannel).to.have.been.calledOnce
        .and.calledWith();
      expect(secondCallResult).to.equal(channel);
    });
  });


  describe('#_subscribeToChannel', () => {

    it('should subscribe on return and end events', () => {
      const eventsRegistry = {};
      channelStub.on = (event, cb) => {
        eventsRegistry[event] = cb;
        return channelStub;
      };
      sinon.spy(channelStub, 'on');
      const sender = new AMQPEventsSender(connectionStub, {queueName});
      sender._channel = channelStub;
      sender._subscribeToChannel();
      expect(channelStub.on).to.have.been.calledTwice
        .and.calledWith('return', eventsRegistry.return)
        .and.calledWith('error', eventsRegistry.error);
    });

    it('after subscription it should reemit error on itself', () => {
      channelStub = new EventEmitter();
      const sender = new AMQPEventsSender(connectionStub, {queueName});
      sender._channel = channelStub;
      const errorHandler = sinon.stub();
      sender.on('error', errorHandler);
      sender._subscribeToChannel();
      const error = new Error('something bad happened');
      channelStub.emit('error', error);
      expect(errorHandler).to.have.been.calledOnce
        .and.calledWith(error);
    });

    it('after subscription it should emit end when appropriate return message', () => {
      channelStub = new EventEmitter();
      const sender = new AMQPEventsSender(connectionStub, {queueName});
      sender._channel = channelStub;
      sender.disconnect = sinon.stub();
      sender._subscribeToChannel();
      expect(sender.disconnect).not.to.have.been.called;
      channelStub.emit('return', {});
      expect(sender.disconnect).not.to.have.been.called;
      channelStub.emit('return', {
        fields: {
          routingKey: 'incorrect key'
        }
      });
      expect(sender.disconnect).not.to.have.been.called;
      channelStub.emit('return', {
        fields: {
          routingKey: queueName
        }
      });
      expect(sender.disconnect).to.have.been.calledOnce;
    });
  });


  describe('#disconnect', () => {

    it('should do nothing if not connected', async () => {
      const sender = new AMQPEventsSender(connectionStub, {queueName});
      const errorHandler = sinon.stub();
      const closeHandler = sinon.stub();
      sender
        .on('error', errorHandler)
        .on('close', closeHandler);

      await sender.disconnect();
      expect(channelStub.deleteQueue).not.to.have.been.called;
      expect(channelStub.close).not.to.have.been.called;
      expect(closeHandler).not.to.have.been.called;
      expect(errorHandler).not.to.have.been.called;
    });

    it('should remove channel promise if failed to connect to channel', async () => {
      const sender = new AMQPEventsSender(connectionStub, {queueName});
      const e = new Error();
      connectionStub.createChannel = sinon.stub().returns(Promise.reject(e));
      try {
        await sender.start();
      } catch (error) {
        //in real code this should be procesed
        if (error !== e) {
          throw error;
        }
      }
      await sender.disconnect();
      expect(sender._channel).to.equal(null);
    });

    it('should close channel', async () => {
      const sender = new AMQPEventsSender(connectionStub, {queueName});
      await sender.start();
      await sender.disconnect();
      expect(channelStub.close).to.have.been.calledOnce;
      expect(sender._channel).to.equal(null);
    });

    it('should emit error if failed to close channel', async () => {
      const sender = new AMQPEventsSender(connectionStub, {queueName});
      await sender.start();
      const error = new Error('something bad happend');
      channelStub.close = sinon.stub().returns(Promise.reject(error));
      const errorHandler = sinon.stub();
      sender.on('error', errorHandler);
      await sender.disconnect();
      expect(channelStub.close).to.have.been.called;
      expect(errorHandler).to.have.been.calledOnce
        .and.calledWith(error);
      expect(sender._channel).to.equal(null);
    });

    it('should emit close after successful disconnect', async () => {
      const sender = new AMQPEventsSender(connectionStub, {queueName});
      await sender.start();
      const closeHandler = sinon.stub();
      sender.on('close', closeHandler);
      await sender.disconnect();
      expect(closeHandler).to.have.been.calledOnce;
      expect(sender._channel).to.equal(null);
    });
  });
});
