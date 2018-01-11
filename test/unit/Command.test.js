'use strict';

const {assert} = require('chai');
const {Command} = require('../..');

describe('AMQPRPC::Command', () => {
  it('Should be constructable', () => {
    const args = [1, 'argument', {}];
    const commandName = 'do_the_work';
    const command = Command.create(commandName, args);

    assert.deepEqual(command.args, args);
    assert.equal(command.command, commandName);
  });

  it('Should serialize correctly', () => {
    const args = [1, 'argument', {}];
    const commandName = 'do_the_work';
    const command = Command.create(commandName, args);
    const packedCommand = command.pack();
    const bufferContent = packedCommand.toString('utf-8');
    const contentAsObject = JSON.parse(bufferContent);

    assert.instanceOf(packedCommand, Buffer);
    assert.deepEqual(contentAsObject, {args, command: commandName});
  });

  it('Should allow to omit args', () => {
    const commandName = 'do_the_work_with_no_any_question';
    const command = Command.create(commandName);
    const packedCommand = command.pack();
    const bufferContent = packedCommand.toString('utf-8');
    const contentAsObject = JSON.parse(bufferContent);

    assert.instanceOf(packedCommand, Buffer);
    assert.deepEqual(contentAsObject, {args: [], command: commandName});
  });

  it('Should unpack correctly', () => {
    const args = [1, 'argument', {}];
    const commandName = 'do_the_work';
    const packedCommand = new Buffer(JSON.stringify({command: commandName, args}));
    const command = Command.fromBuffer(packedCommand);

    assert.instanceOf(command, Command);
    assert.deepEqual(command.args, args);
    assert.equal(command.command, commandName);
  });

  it('Should throw error while unpacking badly structured content', () => {
    const pack1 = new Buffer(JSON.stringify({command: 'command', args: ''}));
    const pack2 = new Buffer(JSON.stringify({command: 'command', args: undefined}));
    const pack3 = new Buffer(JSON.stringify({command: 'command', args: null}));
    const pack4 = new Buffer(JSON.stringify({command: 'command', args: {}}));
    const pack5 = new Buffer(JSON.stringify({command: 'command', args: 123}));
    const pack6 = new Buffer(JSON.stringify({command: null, args: 123}));
    const pack7 = new Buffer(JSON.stringify({command: 123, args: 123}));
    const pack8 = new Buffer(JSON.stringify({command: '', args: 123}));

    assert.throws(
      () => Command.fromBuffer(pack1),
      'Expect args field to be present and not false in serialized command'
    );

    assert.throws(
      () => Command.fromBuffer(pack2),
      'Expect args field to be present and not false in serialized command'
    );

    assert.throws(
      () => Command.fromBuffer(pack3),
      'Expect args field to be present and not false in serialized command'
    );

    assert.throws(
      () => Command.fromBuffer(pack4),
      'Expect args field to be array'
    );

    assert.throws(
      () => Command.fromBuffer(pack5),
      'Expect args field to be array'
    );

    assert.throws(
      () => Command.fromBuffer(pack6),
      'Expect command field to be present and not false in serialized command'
    );

    assert.throws(
      () => Command.fromBuffer(pack7),
      'Expect command field to be string'
    );

    assert.throws(
      () => Command.fromBuffer(pack8),
      'Expect command field to be present and not false in serialized command'
    );
  });

  it('Should unpack packed correctly', () => {
    const args = [1, 'argument', {}];
    const commandName = 'do_the_work';
    const command = Command.create(commandName, args);

    assert.deepEqual(command, Command.fromBuffer(command.pack()));
  });
});
