# Global





* * *

## Class: AMQPRPCClient
Creates a new instance of an RPC client.


## Class: AMQPRPCClient
Creates a new instance of an RPC client.

**TIMEOUT**:  , Returns a timeout for a command result retrieval.
### AMQPRPCClient.sendCommand(command, args) 

Send a command into RPC queue.

**Parameters**

**command**: `String`, Command name

**args**: `Array.&lt;*&gt;`, Array of any arguments provided to the RPC server callback

**Returns**: `Promise.&lt;*&gt;`

**Example**:
```js
client.sendCommand('some-command-name', [
 {foo: 'bar'},
 [1, 2, 3]
]);
```

### AMQPRPCClient.disconnect() 

Disconnect from RPC channel.

**Returns**: `Promise`



* * *










