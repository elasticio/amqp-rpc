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
   * @param {Object} params
   * @param {String} [params.queueName] queue for sending events, should correspond with AMQPEventsReceiver
   * @param {Number} [params.TTL=AMQPEventsSender.TTL] TTL of messages
   */
  constructor(amqpConnection, params = {}) {
    super();
    this._connection = amqpConnection;

    this._params = params;
    params.TTL = params.TTL || AMQPEventsSender.TTL;
    this._queueName = params.queueName;

    this._channel = null;
  }

  /**
   * Send message to receiver
   * @param {*} message, anything that may be serialized by JSON.stringify
   * @retiurns {Promise}
   */
  async send(message) {
    const packedMessage = new Buffer(JSON.stringify(message));
    try {
      await this._channel.sendToQueue(this._queueName, packedMessage, {
        mandatory: true,
        expiration: this._params.TTL
      });
    } catch (e) {
      this.emit('error', e);
    }
  }

  /**
   * Opposite to this.start() – closing communication channel
   * NOTE! Race condition is not handled here,
   *    so it's better to not invoke the method several times (e.g. from multiple "threads")
   *
   * @return {Promise<void>}
   */
  async disconnect() {
    if (this._channel) {
      try {
        await this._channel.close();
      } catch (e) {
        this._channel = null;
        this.emit('error', e);
        return;
      }
      this.emit('close');
      this._channel = null;
    }
  }

  /**
   * Channel initialization, has to be done before starting working
   * NOTE! Race condition is not handled here,
   *    so it's better to not invoke the method several times (e.g. from multiple "threads")
   *
   * @return {Promise<void>}
   */
  async start() {
    if (this._channel) {
      return;
    }
    try {
      this._channel = await this._connection.createChannel();
      this._subscribeToChannel();
    } catch (error) {
      this.emit('error', error);
      // throw error;
    }
  }

  /**
   * Subscribe to events on channel.
   * Events used to understand, if listener is ok
   * and/or for error handling
   */
  _subscribeToChannel() {
    this._channel
      .on('return', async ({fields}) => {
        if (fields && fields.routingKey === this._queueName) {
          this.disconnect();
        }
      })
      .on('error', (e) => {
        this.emit('error', e);
      });
  }

  /**
   * Returns a timeout for a command result retrieval.
   *
   * @static
   * @returns {Number}
   */
  static get TTL() {
    return 10 * 60 * 1000;
  }
}

module.exports = AMQPEventsSender;
