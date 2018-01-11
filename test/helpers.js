const amqp = require('amqplib');

const AMQP_URI = 'amqp://localhost';

let amqpConn;

/**
 * Get amqp connection
 * @returns {Promise<amqplib.Connection>}
 */
module.exports.getAmqpConnection = async function () {
  if (!amqpConn) {
    amqpConn = await amqp.connect(AMQP_URI);
  }
  return amqpConn;
};

/**
 * Close currently opened amqp connection
 */
module.exports.closeAmqpConnection = async function () {
  if (amqpConn) {
    await amqpConn.close();
    amqpConn = null;
  }
};
