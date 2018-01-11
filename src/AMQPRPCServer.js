const Command = require('./Command');
const CommandResult = require('./CommandResult');
const AMQPEndpoint = require('./AMQPEndpoint');

/**
 * Implementation for an AMQP RPC server.
 *
 * @class
 */
class AMQPRPCServer extends AMQPEndpoint {
  /**
   * Creates a new instance of RPC server.
   *
   * @param {*} connection Connection reference created from `amqplib` library
   *
   * @param {Object} params
   * @param {String} params.requestsQueue queue when AMQPRPC client sends commands, should correspond with AMQPRPCClient
   *    default is '' which means auto-generated queue name
   */
  constructor(connection, params = {}) {
    params.requestsQueue = params.requestsQueue || '';

    super(connection, params);

    this._requestsQueue = params.requestsQueue;
    this._commands = {};
  }

  /**
   * Initialize RPC server.
   *
   * @returns {Promise}
   * @override
   */
  async start() {
    await super.start();


    if (this._requestsQueue === '') {
      const response = await this._channel.assertQueue('', {exclusive: true});
      this._requestsQueue = response.queue;
    }

    const consumeResult = await this._channel.consume(this._requestsQueue, (msg) => this._handleMsg(msg));
    this._consumerTag = consumeResult.consumerTag
  }

  /**
   * Opposite to this.start()
   *
   * @returns {Promise}
   */
  async disconnect() {
    await this._channel.cancel(this._consumerTag);

    if (this._params.requestsQueue === '') {
      await this._channel.deleteQueue(this._requestsQueue);
      this._requestsQueue = '';
    }

    await super.disconnect();
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
   *
   * @private
   */
  async _handleMsg(msg) {

    this._channel.ack(msg);
    const replyTo = msg.properties.replyTo;
    const correlationId = msg.properties.correlationId;

    try {
      const result = await this._dispatchCommand(msg);

      const content = new CommandResult(CommandResult.STATES.SUCCESS, result).pack();
      this._channel.sendToQueue(replyTo, content, {correlationId});

    } catch (error) {
      const content = new CommandResult(CommandResult.STATES.ERROR, error).pack();
      this._channel.sendToQueue(replyTo, content, {correlationId});
    }
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

  /**
   * Allows to get generated value when params.requestsQueue was set to '' (empty string) or omitted
   * @returns {String} an actual name of the queue used by the instance for receiving replies
   */
  get requestsQueue() {
    return this._requestsQueue;
  }
}

module.exports = AMQPRPCServer;
