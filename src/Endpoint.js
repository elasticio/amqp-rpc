'use strict';

/**
 * Common class for RPCServer, RPCClient
 *
 * @class
 */
class Endpoint {
  /**
   *
   */
  constructor(id, {incomingConnection, outgoingConnection}, options = {}) {
    this._incomingConnection = incomingConnection;
    this._outgoingConnection = outgoingConnection;
    this._commands = {};
    this._options = options;
    this._initialized = false;
    this._id = id;
  }

  /**
   *
   */
  async start() {
    if (this._initialized) {
      return;
    }

    await this._incomingConnection.start(this._getId());
    await this._outgoingConnection.start(this._getId());
  }

  /**
   * Disconnects from an RPC queue.
   *
   * @returns {Promise}
   */
  async close() {
    try {
      if (!this._initialized) return;

      await this._incomingConnection.close(this._getId());
      await this._outgoingConnection.close(this._getId());
    } finally {
      this._initialized = false;
    }
  }

  /**
   *
   * @returns {String}
   */
  _getId() {
    return this._id;
  }
}

module.exports = Endpoint;

