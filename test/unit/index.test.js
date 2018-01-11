'use strict';

const {assert} = require('chai');
const index = require('../..');

describe('AMQPRPC::EntryPoint', () => {
  it('Should just properly export all the classes', () => {
    assert.isFunction(index.AMQPRPCClient);
    assert.isFunction(index.AMQPRPCServer);
    assert.isFunction(index.Command);
    assert.isFunction(index.CommandResult);
    assert.isFunction(index.AMQPEventsSender);
    assert.isFunction(index.AMQPEventsReceiver);
  });
});
