const EventEmitter = require('events');

/**
 * @class AMQPEventsSender
 * Provides stream like "sink" for events, that should be
 * transported though amqp
 * Should be used with AMQPEventsReceiver. In such case
 * will correctly handle queue removal, connection/disconnection
 * listener destroy providing stream-like events inteface (end/error/close);
 * @emits AMQPEventsSender#data
 * @emits AMQPEventsSender#close
 * @emits AMQPEventsSender#end
 */
//TODO think about: this class may be transformed to real ReadableStream
//when it would be required
class AMQPEventsSender extends EventEmitter {

  /**
   * @constructor
   * @param {amqplib.Connection} amqpConnection
   * @param {String} queueName endpoint address, to send data to
   */
  constructor(amqpConnection, queueName) {
    super();
    this._connection = amqpConnection;
    this._queueName = queueName;
    this._channelPromise = null;
  }

  /**
   * Send message to receiver
   * @param {*} message, anything that may be stringified bu JSON.stringify
   * @retiurns {Promise}
   */
  async send(message) {
    const channel = await this._initChannel();
    const packedMessage = new Buffer(JSON.stringify(message));
    try {
      await channel.sendToQueue(this._queueName, packedMessage, { //@todo fix
        mandatory: true
      });
    } catch (e) {
      this.emit('error', e);
    }
  }

  /**
   * Disconnect from event channel
   * @returns {Promise}
   */
  async disconnect() {
    if (this._channelPromise) {
      let channel;
      try {
        channel = await this._channelPromise;
      } catch (e) {
        //broken channel -- nothing to close;
        this._channelPromise = null;
        return;
      }
      try {
        await channel.deleteQueue(this._queueName);
      } catch (e) {
        //skip this error, there may be no queue
      }
      try {
        await channel.close();
      } catch (e) {
        this._channelPromise = null;
        this.emit('error', e);
        return;
      }
      this.emit('close');
      this._channelPromise = null;
    }
  }

  /**
   * Create and intialize amqp channel for communication
   * @returns {Promise}
   */
  _initChannel() {
    if (this._channelPromise) {
      return this._channelPromise;
    }
    return this._channelPromise = this._connection.createChannel()
      .then(
        (channel) => {
          this._subscribeToChannel(channel);
          return channel;
        },
        (error) => {
          this.emit('error', error);
          return Promise.reject(error);
        }
      );
  }

  /**
   * Subscribe to events on channel.
   * Events used to understand, if listener is ok
   * and/or for error handling
   */
  _subscribeToChannel(channel) {
    channel
      .on('return', async ({ fields }) => {
        if (fields && fields.routingKey === this._queueName) {
          this.disconnect();
        }
      })
      .on('error', (e) => {
        this.emit('error', e);
      });
  }

}
module.exports = AMQPEventsSender;
