const CommandResult = require('./CommandResult');
const Command = require('./Command');

/**
 * Implementation for an AMQP RPC server.
 *
 * @class
 */
class AMQPRPCServer {
  /**
   * Creates a new instance of RPC server.
   *
   * @param {*} connection Connection reference created from `amqplib` library
   *
   * @param {Object} options
   * @param {String} options.exchange name of the exchange, should correspond with AMQPRPCClient
   * @param {String} [options.queue=''] queues for receiving requests from AMQPRPCClient,
   *    default is '' which means auto-generated queue name
   * @param {String} options.key routing key for messages with commands, should correspond with AMQPRPCServer
   * @example
   * const connection = await amqplib.connect(AMPQ_URI);
   * const exchange = 'SOME_EXCHANGE_STRING';
   * const key = 'SOME_KEY_STRING';
   * const server = new AMQPRPCServer(connection {exchange, key});
   */
  constructor(connection, { exchange, queue = '', key }) {
    this._connection = connection;
    this._exchange = exchange;
    this._queue = queue;
    this._key = key;
    this._commands = {};
    this._initialized = false;
    this._channel = null;
  }

  /**
   * Starts an RPC server (really executed only once):
   *  - creating a channel
   *  - asserting a queue and an exchange, binding them (if skipAssert is false)
   *  - starting listening queue for commands
   * Afterwards, it will try to call a specified command via {@link AMQPRPCServer#addCommand}.
   * const {boolean} [skipAssert=false]
   *
   * @returns {Promise}
   */
  async start(skipAssert = false) {
    if (this._initialized) {
      return;
    }

    this._initialized = true;
    this._channel = await this._connection.createChannel();

    if (!skipAssert) {
      await Promise.all([
        this._channel.assertQueue(this._queue, { exclusive: true }),
        this._channel.assertExchange(this._exchange)
      ]);
      await this._channel.bindQueue(this._queue, this._exchange, String(this._key));
    }

    this._listenQueue(this._queue); //@todo make sure if this doesn't require awaiting
  }

  /**
   * Disconnects from an RPC queue.
   *
   * @returns {Promise}
   */
  async disconnect() {
    try {
      if (!this._initialized) return;

      await this._channel.close();
    } catch (e) {
      throw e;
    } finally {
      this._initialized = false;
      this._channel = {};
    }
  }

  /**
   * Registers a new command in this RPC server instance.
   *
   * @param {String} command Command name
   * @param {Function} cb Callback that must be called when server got RPC command
   * @returns {AMQPRPCServer}
   */
  addCommand(command, cb) {
    this._commands[command] = cb;

    return this;
  }

  /**
   * Starts listening for the events in specified queue.
   *
   * @private
   * @param {String} queue Queue name
   */
  _listenQueue(queue) {
    this._channel.consume(queue, async (msg) => {
      this._channel.ack(msg);

      try {
        const result = await this._dispatchCommand(msg);

        this._sendAnswer(
          msg.properties.replyTo,
          new CommandResult(CommandResult.STATES.SUCCESS, result)
        );
      } catch (error) {
        this._sendAnswer(
          msg.properties.replyTo,
          new CommandResult(CommandResult.STATES.ERROR, error)
        );
      }
    });
  }

  /**
   * Sends a packet into the queue.
   *
   * @private
   * @param {String} queue Queue name
   * @param {CommandResult} result
   */
  _sendAnswer(queue, result) {
    this._channel.sendToQueue(queue, result.pack());
  }

  /**
   * Dispatches a command with specified message.
   *
   * @private
   * @param {Object} msg
   */
  _dispatchCommand(msg) {
    const command = Command.fromBuffer(msg.content);

    if (this._commands[command.command] && this._commands[command.command] instanceof Function) {
      return this._commands[command.command].apply(null, command.args);
    }

    throw new Error(`Unknown command ${command.command}`);
  }
}

module.exports = AMQPRPCServer;
