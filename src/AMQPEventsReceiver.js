const assert = require('assert');
const EventEmitter = require('events');

/**
 * @class AMQPEventsReceiver
 * Provides stream-like "endpoint" that transforms sequence of messages in amqp queue
 * into sequence of 'data' events.
 * Should be used in pair with AMQPEventsSender class
 * In such case provides end/close events that imitate nodejs's ReadableStream,
 * and cleaning of used amqp resources (queue)
 * @emits AMQPEventsReceiver#data
 * @emits AMQPEventsReceiver#close
 * @emits AMQPEventsReceiver#end
 */
//TODO think about: this class may be transformed to real ReadableStream
//when it would be required

class AMQPEventsReceiver extends EventEmitter {

  /**
   * @constructor
   * @param {amqplib.Connection} amqpConnection
   * @param {String} queueName
   */
  constructor(amqpConnection, queueName = '') {
    super();
    this._connection = amqpConnection;
    this._queueName = queueName;
  }

  /**
   * Begin to listen for messages from amqp
   * @returns {Promise<String>} name of endpoint to send messages
   */
  async receive() {
    assert(!this._channel && !this._queue, 'Already receiving');
    this._channel = await this._connection.createChannel();
    const queue = await this._channel.assertQueue(this._queueName, {
      durable: true
    });
    this._queueName = queue.queue;
    this._channel.consume(this._queueName, this._handleMessage.bind(this));

    return this._queueName;
  }

  /**
   * Stop listening for messages
   */
  async disconnect() {
    if (!this._channel) {
      return;
    }
    const channel = this._channel;
    this._channel = null;
    try {
      await channel.deleteQueue(this._queueName);
    } catch (e) {
      //it's ok to ignore this error, as queue
      //may be deleted by AMQPStreamSender
    }
    await channel.close();

    this.emit('close');
  }

  _handleMessage(msg) {
    if (msg === null) {
      this.emit('end');
      this.disconnect();
      return;
    }
    this._channel.ack(msg);

    try {
      const messageData = JSON.parse(msg.content.toString());
      this.emit('data', messageData);
    } catch (e) {
      this.emit('error', e);
    }
  }
}
module.exports = AMQPEventsReceiver;
