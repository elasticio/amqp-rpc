# Global





* * *

## Class: CommandResult
Creates a new instance of a command result.


## Class: CommandResult
Creates a new instance of a command result.

**STATES**:  , Returns a dictionary of possible STATES in the result.
### CommandResult.pack() 

Packs a command result into the buffer for sending across queues.

**Returns**: `Buffer`

### CommandResult.create(args) 

Static helper for creating new instances of [CommandResult](#commandresult).

**Parameters**

**args**: , Static helper for creating new instances of [CommandResult](#commandresult).

**Returns**: `CommandResult`

### CommandResult.fromBuffer(buffer) 

Static helper for creating a new instance of [CommandResult](#commandresult) from Buffer.

**Parameters**

**buffer**: `Buffer`, Static helper for creating a new instance of [CommandResult](#commandresult) from Buffer.

**Returns**: `CommandResult`

**Example**:
```js
const commandResult = CommandResult.fromBuffer({state: CommandResult.STATES.SUCCESS, data: []});
const buffer = commandResult.pack();

assert.instanceOf(buffer, Buffer);
assert.deepEqual(CommandResult.fromBuffer(buffer), commandResult);
```



* * *










