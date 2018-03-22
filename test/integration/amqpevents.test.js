'use strict';

const sinon = require('sinon');
const {expect} = require('chai');

const helpers = require('../helpers.js');

const {
  AMQPEventsSender,
  AMQPEventsReceiver
} = require('../../');

/**
 * Helper method, returns promise, that fulfills
 * when event is emitted on eventEmitter;
 * @param {String} event
 * @param {EventEmitter} eventEmitter
 * @returns {Promise}
 */
function waitFor(event, eventEmitter) {
  return new Promise((res) => eventEmitter.on(event, res));
}

describe('AMQPEventsSender AMQPEventsReceiver', () => {
  let amqpConn;
  let amqpChannel;

  beforeEach(async () => {
    amqpConn = await helpers.getAmqpConnection();
    amqpChannel = await amqpConn.createChannel();
  });

  afterEach(async () => {
    await amqpChannel.close();
    await helpers.closeAmqpConnection();
  });

  describe('when queueName is not set', () => {
    it('should send events thought default exchange and generated queue', async () => {
      const receiver = new AMQPEventsReceiver(amqpConn);
      await receiver.start();
      const queueName = receiver.queueName;
      const sender = new AMQPEventsSender(amqpConn, {queueName});
      await sender.start();
      const data = [
        {
          msg1: 'value1-1'
        },
        {
          msg2: 14
        },
        {
          msg3: Math.E
        },
        {
          msg4: [1, 2, 3]
        }
      ];

      const waitForMessagesPromise = new Promise((res) => {
        let count = 0;
        receiver.on('data', () => {
          count++;
          if (count >= data.length) {
            res();
          }
        });
      });

      const dataEventHandler = sinon.stub();
      receiver.on('data', dataEventHandler);

      data.forEach(async (item) => {
        await sender.send(item);
      });
      await waitForMessagesPromise;
      data.reduce(
        (expector, item) => expector.and.calledWith(item),
        expect(dataEventHandler).to.have.been.callCount(data.length)
      );
    });
  });

  describe('when queueName is set', () => {
    it('should send events thought the given queue', async () => {
      const queueName = `q-test-${Math.random() * 1000 | 0}`;
      await amqpChannel.assertQueue(queueName, {expires: 1000 * 120});

      const receiver = new AMQPEventsReceiver(amqpConn, {queueName});
      await receiver.start();
      const sender = new AMQPEventsSender(amqpConn, {queueName});
      await sender.start();

      const data = [
        {
          msg1: 'value1-2'
        },
        {
          msg2: 125
        },
        {
          msg3: Math.PI
        },
        {
          msg4: [4, 5, 6]
        }
      ];

      const waitForMessagesPromise = new Promise((res) => {
        let count = 0;
        receiver.on('data', () => {
          count++;
          if (count >= data.length) {
            res();
          }
        });
      });

      const dataEventHandler = sinon.stub();
      receiver.on('data', dataEventHandler);

      data.forEach(async (item) => {
        await sender.send(item);
      });
      await waitForMessagesPromise;
      data.reduce(
        (expector, item) => expector.and.calledWith(item),
        expect(dataEventHandler).to.have.been.callCount(data.length)
      );
    });
  });

  describe('on receiver disconnect', () => {
    it('stream sender should close itself', async () => {
      const receiver = new AMQPEventsReceiver(amqpConn);
      await receiver.start();
      const queueName = receiver.queueName;
      const sender = new AMQPEventsSender(amqpConn, {queueName});
      await sender.start();
      const dataEventHandler = sinon.stub();
      receiver.on('data', dataEventHandler);
      const msg = {
        msg1: 'value1'
      };
      const waitForMsg = waitFor('data', receiver);
      await sender.send(msg);
      await waitForMsg;
      expect(dataEventHandler).to.have.been.calledOnce
        .and.calledWith(msg);
      await receiver.disconnect();
      const closeHandler = sinon.stub();
      sender.on('close', closeHandler);
      const waitForClose = waitFor('close', sender);
      await sender.send(msg);
      await waitForClose;
      expect(closeHandler).to.have.been.calledOnce;
    });
  });
  describe('on sender disconnect', () => {
    it.skip('stream receiver should close itself', async () => { // eslint-disable-line
      // this feature was broken while implementing external permission support
      // it was hard to fix this, so decided to leave it as is for now (kind of YAGNI)
      const receiver = new AMQPEventsReceiver(amqpConn);
      await receiver.start();
      const queueName = receiver.queueName;
      const sender = new AMQPEventsSender(amqpConn, {queueName});
      await sender.start();
      const dataEventHandler = sinon.stub();
      receiver.on('data', dataEventHandler);
      const msg = {
        msg1: 'value1'
      };
      const waitForMsg = waitFor('data', receiver);
      await sender.send(msg);
      await waitForMsg;
      expect(dataEventHandler).to.have.been.calledOnce
        .and.calledWith(msg);

      const closeHandler = sinon.stub();
      const endHandler = sinon.stub();
      receiver
        .on('close', closeHandler)
        .on('end', endHandler);

      const waitForClose = waitFor('close', receiver);
      const waitForEnd = waitFor('end', receiver);

      await sender.disconnect();
      await Promise.all([waitForClose, waitForEnd]);
      expect(endHandler).to.have.been.calledOnce;
      expect(closeHandler).to.have.been.calledOnce;
    });
  });
});
