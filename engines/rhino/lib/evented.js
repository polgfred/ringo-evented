var {InetSocketAddress} = java.net;
var {Executors} = java.util.concurrent;

var {ServerBootstrap} = org.jboss.netty.bootstrap;
var {ChannelState,
     ChannelStateEvent,
     ExceptionEvent,
     MessageEvent} = org.jboss.netty.channel;
var {NioServerSocketChannelFactory} = org.jboss.netty.channel.socket.nio;

// stuff that we need for byte streams
require('binary');

var {EventManager} = require('eventmanager');

/**
 * Create a new generic server. (You probably won't ever call this directly.)
 *
 * @returns a new socket server
 */
function SocketServer(options) {
  this.options = options || {};
  this.bootstrap = new ServerBootstrap(
    new NioServerSocketChannelFactory(
      Executors.newCachedThreadPool(),
      Executors.newCachedThreadPool()));
}

/**
 * (Internal) Dispatch socket-level events to the SocketServer's event listener.
 */
SocketServer.prototype.dispatchUpstreamEvent = function (ctx, evt) {
  if (evt instanceof ChannelStateEvent) {
    this.handleStateChange(ctx, evt);
  } else if (evt instanceof MessageEvent) {
    this.handleMessage(ctx, evt);
  } else if (evt instanceof ExceptionEvent) {
    this.handleError(ctx, evt);
  }
};

/**
 * (Internal) Handle a Netty ChannelStateEvent.
 */
SocketServer.prototype.handleStateChange = function (ctx, evt) {
  var conn = this.wrapConnection(ctx.channel);
  if (evt.state == ChannelState.OPEN) {
    this.notify(evt.value ? 'open' : 'close', conn);
  } else if (evt.state == ChannelState.BOUND) {
    this.notify(evt.value ? 'bind' : 'unbind', conn);
  } else if (evt.state == ChannelState.CONNECTED) {
    this.notify(evt.value ? 'connect' : 'disconnect', conn);
  }
};

/**
 * (Internal) Handle a Netty MessageEvent. Server subtypes need to override this, as it does nothing.
 */
SocketServer.prototype.handleMessage = function (ctx, evt) {
};

/**
 * (Internal) Handle a Netty ExceptionEvent. Server subtypes can be smarter about this if they wish.
 */
SocketServer.prototype.handleError = function (ctx, evt) {
  var conn = this.wrapConnection(ctx.channel);
  this.notify('error', conn, evt.cause);
};

/**
 * Mixin EventManager to get subscribe/notify behavior.
 */
SocketServer.prototype.listen = EventManager.listen;
SocketServer.prototype.notify = EventManager.notify;

/**
 * Start the server by binding to the specified port.
 */
SocketServer.prototype.start = function () {
  this.bootstrap.bind(new InetSocketAddress(this.options.port));
};

/**
 * Module exports.
 */
exports.SocketServer = SocketServer;
