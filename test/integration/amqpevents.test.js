const sinon = require('sinon');
const { expect } = require('chai');

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

  beforeEach(async () => {
    amqpConn = await helpers.getAmqpConnection();
  });

  afterEach(async () => {
    await helpers.closeAmqpConnection();
  });


  it('should send events throught amqp', async () => {
    const receiver = new AMQPEventsReceiver(amqpConn);
    const queueName = await receiver.receive();
    const sender = new AMQPEventsSender(amqpConn, queueName);
    const data = [
      {
        msg1: 'value1'
      },
      {
        msg2: 'value2'
      },
      {
        msg3: 'value3'
      },
      {
        msg4: 'value4'
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

  it('stream sender should close itself on receiver disconnect', async () => {
    const receiver = new AMQPEventsReceiver(amqpConn);
    const queueName = await receiver.receive();
    const sender = new AMQPEventsSender(amqpConn, queueName);
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

  it('stream receiver should close itself on sender disconnect', async () => {
    const receiver = new AMQPEventsReceiver(amqpConn);
    const queueName = await receiver.receive();
    const sender = new AMQPEventsSender(amqpConn, queueName);
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
