const assert = require('assert');

/**
 * This class is responsible for wrapping command structure for sending across queues.
 * It uses when you need to send a command request to an RPC queue in Rabbit.
 *
 * @class
 */
class Command {
  /**
   * Creates a new command instance.
   *
   * @param {String} command RPC command name
   * @param {Array<*>} args Array of arguments to provide an RPC
   * @param {replyTo} command RPC command name
   * @example
   * const command = new Command('commandName', [
   *  {foo: 'bar'},
   *  [1, 2, 3]
   * ]);
   */
  constructor(command, args, replyTo) {
    this.command = command;
    this.args = args;
    this.replyTo = replyTo;
  }

  /**
   * Pack a command into the buffer for sending across queues.
   *
   * @returns {Buffer}
   */
  pack() {
    // return new Buffer(JSON.stringify({
    return JSON.stringify({
      command: this.command,
      args: this.args,
      replyTo: this.replyTo
      // }));
    });
  }

  /**
   * Static helper for creating new instances of a Command.
   *
   * @static
   * @param args
   * @returns {Command}
   */
  static create(...args) {
    return new this(...args);
  }

  /**
   * Static helper for creating new Command instances.
   *
   * @static
   * @param {Buffer} buffer
   * @returns {Command}
   */
  static fromBuffer(buffer) {
    // const str = buffer.toString('utf-8');
    const str = buffer;
    const obj = JSON.parse(str);

    assert(obj.command, 'Expect command field to be present and not false in serialized command');
    assert(typeof obj.command === 'string', 'Expect command field to be string');
    assert(obj.replyTo, 'Expect replyTo field to be present and not false in serialized command');
    assert(typeof obj.replyTo === 'string', 'Expect replyTo field to be string');

    return new Command(obj.command, obj.args, obj.replyTo);
  }
}

module.exports = Command;
