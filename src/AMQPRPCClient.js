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
   * @param {String} exchange Exchange
   * @param {String} key Key
   * @param {Object} options Additional options for the client
   * @param {Number} [options.timeout=60000] Timeout for cases when server is not responding
   */
  constructor(connection, exchange, key, options) {
    this._connection = connection;
    this._exchange = exchange;
    this._key = key;
    this._options = Object.assign({timeout: AMQPRPCClient.TIMEOUT}, options);
    this._channel = null;
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
        await this._channel.assertExchange(this._exchange, 'direct');
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

    const responseQ = await this._channel.assertQueue('', {exclusive: true});
    const promise = new Promise((resolve, reject) => {
      const timeout = setTimeout(reject, this._options.timeout, new Error('Timeout'));

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
