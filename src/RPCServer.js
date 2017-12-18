const CommandResult = require('./CommandResult');
const Command = require('./Command');
const Endpoint = require('./Endpoint');


/**
 * Implementation for an AMQP RPC server.
 *
 * @class
 */
class RPCServer extends Endpoint {
  /**
   * Creates a new instance of RPC server.
   *
   */
  constructor(...args) {
    super(...args);
    this._commands = {};
  }

  /**
   * Starts an RPC server (really executed only once):
   *  - creating a channel
   *  - asserting a queue and an exchange, binding them (if skipAssert is false)
   *  - starting listening queue for commands
   * Afterwards, it will try to call a specified command via {@link RPCServer#addCommand}.
   * const {boolean} [skipAssert=false]
   *
   * @returns {Promise}
   */
  async start() {
    await super.start();
    this._listen();
  }

  /**
   * Registers a new command in this RPC server instance.
   *
   * @param {String} command Command name
   * @param {Function} cb Callback that must be called when server got RPC command
   * @returns {RPCServer}
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
  _listen() {
    console.log('_listen', `data-${this._id}`)
    this._incomingConnection.on(`data-${this._id}`, async (msg) => {
      const command = Command.fromBuffer(msg);
      console.log('command', command)
      try {
        const result = await this._dispatchCommand(command);

        this._sendAnswer(
          command.replyTo,
          new CommandResult(CommandResult.STATES.SUCCESS, result)
        );
      } catch (error) {
        this._sendAnswer(
          command.replyTo,
          new CommandResult(CommandResult.STATES.ERROR, error)
        );
      }
    });
  }

  /**
   * Sends a packet into the queue.
   *
   * @private
   * @param {String} address
   * @param {CommandResult} result
   */
  _sendAnswer(address, result) {
    this._outgoingConnection.send(address, result.pack());
  }

  /**
   * Dispatches a command with specified message.
   *
   * @private
   * @param {Command} command
   */
  _dispatchCommand(command) {
    if (this._commands[command.command] instanceof Function) {
      return this._commands[command.command].apply(null, command.args);
    }

    throw new Error(`Unknown command ${command.command}`);
  }
}

module.exports = RPCServer;
