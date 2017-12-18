const Command = require('./Command');
const CommandResult = require('./CommandResult');
const Endpoint = require('./Endpoint');

/**
 * This class is responsible for sending commands to the RPC server.
 *
 * @class
 */
class RPCClient extends Endpoint {
  /**
   * Creates a new instance of an RPC client.
   *
   */
  constructor(...args) {
    super(...args);
    this._cmdNumber = 0;

    this._timeout = this._options.timeout || RPCClient.TIMEOUT;
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
  async sendCommand(commandName, args) {
    const replyTo = this._generateReplyTo();
    const command = new Command(commandName, args, replyTo);

    const promise = new Promise((resolve, reject) => {
      const timeout = setTimeout(reject, this._timeout, new Error('Timeout sendCommand'));

      this._incomingConnection.on(replyTo, async (msg) => {

        clearTimeout(timeout);

        // @todo check if this workaround needed here
        // if (!msg) {
        //   //skip, it's queue close message
        //   return;
        // }

        try {
          const response = CommandResult.fromBuffer(msg);

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

    this._outgoingConnection.send(
      `data-${this._getId()}`,
      command.pack(),
      {replyTo}
    );

    return await promise;
  }

  /**
   *
   * @private
   * @returns {String} generated name if queueNamePrefix is set or '' if queueNamePrefix is empty
   */
  _generateReplyTo() {
    return `${this._getId()}-reply-${this._cmdNumber++}`;
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

module.exports = RPCClient;
