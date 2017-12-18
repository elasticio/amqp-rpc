const {EventEmitter} = require('events');

class AbstractConnection extends EventEmitter {
  async start(id) {

  }

  async close(id) {
    this.removeAllListeners();
  }
}

class IncomingConnection extends AbstractConnection {

}

class OutgoingConnection extends AbstractConnection {
  async send(address, msg) {
  }
}

exports.AbstractConnection = AbstractConnection;
exports.IncomingConnection = IncomingConnection;
exports.OutgoingConnection = OutgoingConnection;
