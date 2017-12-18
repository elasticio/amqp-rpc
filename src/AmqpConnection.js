const {
  IncomingConnection,
  OutgoingConnection
} = require('./AbstractConnection');


class AMQPIncomingConnection extends IncomingConnection {
  constructor(amqpLibConnection) {
    super();
    this._connection = amqpLibConnection;
  }

  async start(id, skipAssert = true) {
    super.start(id);
    //@todo consider skipAssert

    this._channel = await this._connection.createChannel();
    await this._channel.assertQueue(this._id);//@todo check options

    this._channel.consume(this._id, (msg) => {
      //@todo
    });

  }
}

class AMQPOutgoingConnection extends OutgoingConnection {
  async send(address, msg) {
  }
}

exports.AbstractConnection = AbstractConnection;
exports.IncomingConnection = IncomingConnection;
exports.OutgoingConnection = OutgoingConnection;

class AmqpConnection extends AbstractConnection {
  constructor(amqpLibConnection) {
    this._connection = amqpLibConnection;
  }

  async start(id) {
    this._channel = await this._connection.createChannel();
  }

  async close(id) {
    await channel.close();
  }

  async send(address, msg) {

  }
}

module.exports = AbstractConnection;

