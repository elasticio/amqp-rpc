const assert = require('assert');

/**
 * This class is responsible for (de)serializing results of a specific commands.
 * Instances of this class are sent by {@link AMQPRPCServer} in response to command requests.
 *
 * @class
 */
class CommandResult {
  /**
   * Creates a new instance of a command result.
   *
   * @param {String} state State from {@link CommandResult.STATES}
   * @param {*} data Any type that can be understandable by `JSON.stringify`
   * @example
   * const commandResult = new CommandResult({
   *  state: CommandResult.STATES.ERROR,
   *  data: new Error('Some error description'),
   * });
   *
   * const commandResult = new CommandResult({
   *  state: CommandResult.STATES.SUCCESS,
   *  data: ['some', 'data', 'here'],
   * });
   */
  constructor(state, data) {
    this.state = state;
    this.data = data;
  }

  /**
   * Packs a command result into the buffer for sending across queues.
   *
   * @returns {Buffer}
   */
  pack() {
    return new Buffer(JSON.stringify({
      state: this.state,
      data: this.data
    }, this.constructor._replacer));
  }

  /**
   * Returns a dictionary of possible STATES in the result.
   *
   * @static
   * @returns {{SUCCESS: String, ERROR: String}}
   */
  static get STATES() {
    return {
      SUCCESS: 'success',
      ERROR: 'error'
    };
  }

  /**
   * Simple traverse function for `JSON.stringify`.
   *
   * @static
   * @private
   * @param {String} key
   * @param {*} value
   * @returns {*}
   */
  static _replacer(key, value) {
    if (value instanceof Error) {
      return {
        message: value.message,
        name: value.name,
        stack: value.stack,
        fileName: value.fileName,
        lineNumber: value.lineNumber,
        columnNumber: value.columnNumber
      };
    }

    return value;
  }

  /**
   * Static helper for creating new instances of {@link CommandResult}.
   *
   * @static
   * @param args
   * @returns {CommandResult}
   */
  static create(...args) {
    return new this(...args);
  }

  /**
   * Static helper for creating a new instance of {@link CommandResult} from Buffer.
   *
   * @static
   * @param {Buffer} buffer
   * @returns {CommandResult}
   * @example
   * const commandResult = CommandResult.fromBuffer({state: CommandResult.STATES.SUCCESS, data: []});
   * const buffer = commandResult.pack();
   *
   * assert.instanceOf(buffer, Buffer);
   * assert.deepEqual(CommandResult.fromBuffer(buffer), commandResult);
   */
  static fromBuffer(buffer) {
    const str = buffer.toString('utf-8');
    const obj = JSON.parse(str);

    assert(obj.state, 'Expect state field to be present and not false it serialized command result');
    assert(
      obj.state === CommandResult.STATES.SUCCESS
      || obj.state === CommandResult.STATES.ERROR,
      `Expect state field to be one of ${CommandResult.STATES.SUCCESS}, ${CommandResult.STATES.ERROR}`
    );

    if (obj.state === CommandResult.STATES.ERROR) {
      const error = new Error(obj.data.message, obj.data.fileName, obj.data.lineNumber);
      error.stack = obj.data.stack;
      error.columnNumber = obj.data.columnNumber;
      obj.data = error;
    }

    return new CommandResult(obj.state, obj.data);
  }
}

module.exports = CommandResult;
