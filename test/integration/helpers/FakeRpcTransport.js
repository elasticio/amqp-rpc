'use strict';


const {
  IncomingConnection,
  OutgoingConnection
} = require('../../../src/AbstractConnection');
const RPCClient = require('../../../src/RPCClient');
const RPCServer = require('../../../src/RPCServer');


function initPair(id) {
  const clientIncoming = new IncomingConnection();
  const clientOutgoing = new OutgoingConnection();
  const serverIncoming = new IncomingConnection();
  const serverOutgoing = new OutgoingConnection();

  serverOutgoing.send = (address, message) => {
    clientIncoming.emit(address, message);
  };
  clientOutgoing.send = (address, message) => {
    serverIncoming.emit(address, message);
  };

  const client = new RPCClient(id, {
    incomingConnection: clientIncoming,
    outgoingConnection: clientOutgoing,
  });
  const server = new RPCServer(id, {
    incomingConnection: serverIncoming,
    outgoingConnection: serverOutgoing,
  });

  server.start();
  client.start();

  return {
    server,
    client
  };
}

exports.init = initPair;

