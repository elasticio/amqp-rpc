'use strict';

const {assert} = require('chai');
const {CommandResult} = require('../..');

describe('AMQPRPC::CommandResult', () => {
  it('Should be constructable with success state', () => {
    const data = {key: 'value', arrKey: [1, 2, 3]};
    const result = CommandResult.create(CommandResult.STATES.SUCCESS, data);

    assert.equal(result.state, CommandResult.STATES.SUCCESS);
    assert.deepEqual(result.data, data);
  });

  it('Should be constructable with error state', () => {
    const error = new Error('example');
    const result = CommandResult.create(CommandResult.STATES.ERROR, error);

    assert.equal(result.state, CommandResult.STATES.ERROR);
    assert.deepEqual(result.data, error);
  });

  it('Should pack correctly with success state', () => {
    const data = {key: 'value', arrKey: [1, 2, 3]};
    const result = CommandResult.create(CommandResult.STATES.SUCCESS, data);
    const packedObject = JSON.parse(result.pack().toString('utf-8'));

    assert.deepEqual(packedObject, {state: CommandResult.STATES.SUCCESS, data});
  });

  it('Should pack correctly with error state', () => {
    const error = new Error('example error');
    const result = CommandResult.create(CommandResult.STATES.ERROR, error);
    const packedObject = JSON.parse(result.pack().toString('utf-8'));

    assert.deepEqual(packedObject, {
      state: CommandResult.STATES.ERROR,
      data: {
        message: error.message,
        name: error.name,
        stack: error.stack
      }
    });
  });
  it('Should pack code with error state', () => {
    const error = new Error('example error');
    error.code = 'E_MISSING_FIELD';
    const result = CommandResult.create(CommandResult.STATES.ERROR, error);
    const packedObject = JSON.parse(result.pack().toString('utf-8'));

    assert.deepEqual(packedObject, {
      state: CommandResult.STATES.ERROR,
      data: {
        message: error.message,
        name: error.name,
        stack: error.stack,
        code: 'E_MISSING_FIELD'
      }
    });
  });

  it('Should unpack correctly with success state', () => {
    const data = {key: 'value', arrKey: [1, 2, 3]};
    const packedCommand = new Buffer(JSON.stringify({state: CommandResult.STATES.SUCCESS, data}));
    const result = CommandResult.fromBuffer(packedCommand);

    assert.instanceOf(result, CommandResult);
    assert.equal(result.state, CommandResult.STATES.SUCCESS);
    assert.deepEqual(result.data, data);
  });

  it('Should unpack correctly with success state', () => {
    const error = new Error('example');
    const data = {
      message: error.message,
      name: error.name,
      stack: error.stack,
      fileName: error.fileName,
      lineNumber: error.lineNumber,
      columnNumber: error.columnNumber
    };

    const packedCommand = new Buffer(JSON.stringify({state: CommandResult.STATES.ERROR, data}));
    const result = CommandResult.fromBuffer(packedCommand);

    assert.instanceOf(result, CommandResult);
    assert.equal(result.state, CommandResult.STATES.ERROR);
    assert.instanceOf(result.data, Error);
    assert.deepEqual({
      message: result.data.message,
      name: result.data.name,
      stack: result.data.stack,
      fileName: result.data.fileName,
      lineNumber: result.data.lineNumber,
      columnNumber: result.data.columnNumber
    }, data);
  });

  it('Should throw error while unpacking badly structured content', () => {
    const pack1 = new Buffer(JSON.stringify({state: '', data: ''}));
    const pack2 = new Buffer(JSON.stringify({state: null, data: ''}));
    const pack3 = new Buffer(JSON.stringify({state: undefined, data: ''}));
    const pack4 = new Buffer(JSON.stringify({state: 123, data: ''}));
    const pack5 = new Buffer(JSON.stringify({state: {}, data: ''}));
    const pack6 = new Buffer(JSON.stringify({state: 'WRONG_STATE', data: ''}));

    assert.throws(
      () => CommandResult.fromBuffer(pack1),
      'Expect state field to be present and not false it serialized command result'
    );

    assert.throws(
      () => CommandResult.fromBuffer(pack2),
      'Expect state field to be present and not false it serialized command result'
    );

    assert.throws(
      () => CommandResult.fromBuffer(pack3),
      'Expect state field to be present and not false it serialized command result'
    );

    assert.throws(
      () => CommandResult.fromBuffer(pack4),
      'Expect state field to be one of success, error'
    );

    assert.throws(
      () => CommandResult.fromBuffer(pack5),
      'Expect state field to be one of success, error'
    );

    assert.throws(
      () => CommandResult.fromBuffer(pack6),
      'Expect state field to be one of success, error'
    );
  });

  it('Should pack and unpack successfully for success state', () => {
    const data = {key: 'value', arrKey: [1, 2, 3]};
    const result = CommandResult.create(CommandResult.STATES.SUCCESS, data);
    const parsedUnparsedResult = CommandResult.fromBuffer(result.pack());

    assert.equal(parsedUnparsedResult.state, result.state);
    assert.deepEqual(parsedUnparsedResult.data, result.data);
  });

  it('Should pack and unpack successfully for error state', () => {
    const error = new Error('example error');
    const result = CommandResult.create(CommandResult.STATES.ERROR, error);
    const parsedUnparsedResult = CommandResult.fromBuffer(result.pack());

    assert.equal(parsedUnparsedResult.state, result.state);
    assert.instanceOf(parsedUnparsedResult.data, Error);
    assert.deepEqual({
      message: parsedUnparsedResult.data.message,
      name: parsedUnparsedResult.data.name,
      stack: parsedUnparsedResult.data.stack,
      fileName: parsedUnparsedResult.data.fileName,
      lineNumber: parsedUnparsedResult.data.lineNumber,
      columnNumber: parsedUnparsedResult.data.columnNumber
    }, {
      message: error.message,
      name: error.name,
      stack: error.stack,
      fileName: error.fileName,
      lineNumber: error.lineNumber,
      columnNumber: error.columnNumber
    });
  });
});
