const Command = require('./Command');
const CommandResult = require('./CommandResult');

/**
 * This class is responsible for sending commands to the RPC server.
 *
 * @class
 */
class AMQPRPCClient {
  /**
   * Creates a new instance of an RPC client.
   *
   * @param {*} connection Instance of `amqplib` library
   *
   * @param {Object} options
   * @param {String} options.exchange name of the exchange, should correspond with AMQPRPCServer
   * @param {String} [options.queueNamePrefix=''] temporary queues for replies from AMQPRPCServer will have the prefix
   *    in name, default is '' which means auto-generated queue name
   * @param {String} options.key routing key for sending commands, should correspond with AMQPRPCServer
   * @param {Number} [options.timeout=60000] Timeout for cases when server is not responding
   * @param {Number} [options.exchangeAlreadyAsserted=false] if false, client will assert exchange before sending first command
   */
  constructor(connection, {exchange, queueNamePrefix = '', key, timeout = AMQPRPCClient.TIMEOUT, exchangeAlreadyAsserted = false}) {
    this._connection = connection;
    this._exchange = exchange;
    this._queueNamePrefix = queueNamePrefix;
    this._exchangeAlreadyAsserted = exchangeAlreadyAsserted;
    this._key = key;
    this._timeout = timeout;
    this._channel = null;
    this._cmdNumber = 0;
  }

  /**
   * Send a command into RPC queue.
   *
   * @param {String} command Command name
   * @param {Array<*>} args Array of any arguments provided to the RPC server callback
   * @returns {Promise<*>}
   * @example
   * client.sendCommand('some-command-name', [
   *  {foo: 'bar'},
   *  [1, 2, 3]
   * ]);
   */
  async sendCommand(command, args) {
    return await this._sendCommand(new Command(command, args));
  }

  /**
   * Disconnect from RPC channel.
   *
   * @returns {Promise}
   */
  async disconnect() {
    if (this._channel) {
      await this._channel.close()
    }
  }

  /**
   * Initialize RPC client.
   *
   * @private
   * @returns {Promise}
   */
  async _init() {
    if (!this._initPromise) {
      this._initPromise = (async () => {
        this._channel = await this._connection.createChannel();
        if (!this._exchangeAlreadyAsserted) {
          await this._channel.assertExchange(this._exchange, 'direct');
        }
      })();
    }

    await this._initPromise;
  }

  /**
   * Sends a command into queue.
   *
   * @private
   * @param {Command} command
   * @returns {Promise}
   */
  async _sendCommand(command) {
    await this._init();

    const responseQ = await this._channel.assertQueue(this._generateQueueName(), {exclusive: true});
    const promise = new Promise((resolve, reject) => {
      const timeout = setTimeout(reject, this._timeout, new Error('Timeout'));

      const consumeResult = this._channel.consume(responseQ.queue, async (msg) => {
        clearTimeout(timeout);

        const consumerTag = (await consumeResult).consumerTag;

        await this._channel.cancel(consumerTag);
        await this._channel.deleteQueue(responseQ.queue);

        if (!msg) {
          //skip, it's queue close message
          return;
        }

        try {
          const response = CommandResult.fromBuffer(msg.content);

          if (response.state === CommandResult.STATES.ERROR) {
            reject(response.data);
          } else {
            resolve(response.data);
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    this._channel.publish(
      this._exchange,
      this._key,
      command.pack(),
      {replyTo: responseQ.queue}
    );

    return await promise;
  }

  /**
   *
   * @private
   * @returns {String} generated name if queueNamePrefix is set or '' if queueNamePrefix is empty
   */
  _generateQueueName() {
    if (!this._queueNamePrefix) {
      // if no _queueNamePrefix, returning '' in order to use queue name auto-generated by broker
      return '';
    }
    return `${this._queueNamePrefix}-${this._cmdNumber++}`;
  }

  /**
   * Returns a timeout for a command result retrieval.
   *
   * @static
   * @returns {Number}
   */
  static get TIMEOUT() {
    return 60 * 1000;
  }
}

module.exports = AMQPRPCClient;
