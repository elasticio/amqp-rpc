# Global





* * *

## Class: AMQPRPCServer
Creates a new instance of RPC server.


## Class: AMQPRPCServer
Creates a new instance of RPC server.

### AMQPRPCServer.start() 

Starts an RPC server.
It will listen for any rpc commands from the client.
Afterwards, it will try to call a specified command via [AMQPRPCServer#addCommand](#amqprpcserver#addcommand).

**Returns**: `Promise`

### AMQPRPCServer.disconnect() 

Disconnects from an RPC queue.

**Returns**: `Promise`

### AMQPRPCServer.addCommand(command, cb) 

Registers a new command in this RPC server instance.

**Parameters**

**command**: `String`, Command name

**cb**: `function`, Callback that must be called when server got RPC command

**Returns**: `AMQPRPCServer`



* * *










