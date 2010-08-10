var {InetSocketAddress} = java.net;
var {Executors} = java.util.concurrent;

var {ServerBootstrap}  = org.jboss.netty.bootstrap;
var {ChannelState, ChannelStateEvent, MessageEvent, ExceptionEvent}
        = org.jboss.netty.channel;
var {NioServerSocketChannelFactory}  = org.jboss.netty.channel.socket.nio;

require('binary'); // lots of stuff that we need for byte streams

var {EventManager} = require('eventmanager');

/**
 * Wrap a java.net.InetAddress object.
 *
 * @returns an internet address
 */
function InetAddress(addr) {
  return {
    get hostname() {
      return String(addr.hostName);
    },
    get address() {
      return String(addr.hostAddress);
    }
  };
}

/**
 * Create a new generic server. (You probably won't ever call this directly.)
 *
 * @returns a new socket server
 */
function SocketServer(options) {
  this.options = options;
  this.bootstrap = new ServerBootstrap(
    new NioServerSocketChannelFactory(
      Executors.newCachedThreadPool(),
      Executors.newCachedThreadPool()));
}

/**
 * (Internal) Wrap a Netty ExceptionEvent in something more useful.
 *
 * @returns a wrapped error
 */
SocketServer.prototype.convertError = function (error) {
  return error; // return it as-is for now
};

/**
 * (Internal) Dispatch socket-level events to the SocketServer's event listener.
 */
SocketServer.prototype.dispatchUpstreamEvent = function (ctx, evt) {
  if (evt instanceof ChannelStateEvent) {
    if (evt.state == ChannelState.OPEN) {
      this.notify(evt.value ? 'open' : 'close', this.wrapConnection(ctx.channel));
    } else if (evt.state == ChannelState.BOUND) {
      this.notify(evt.value ? 'bind' : 'unbind', this.wrapConnection(ctx.channel));
    } else if (evt.state == ChannelState.CONNECTED) {
      this.notify(evt.value ? 'connect' : 'disconnect', this.wrapConnection(ctx.channel));
    } else {
      ctx.sendUpstream(evt);
    }
  } else if (evt instanceof MessageEvent) {
    this.notify('data', this.wrapConnection(ctx.channel), this.convertMessage(evt.message));
  } else if (evt instanceof ExceptionEvent) {
    this.notify('error', this.wrapConnection(ctx.channel), this.convertError(evt.cause));
  } else {
    ctx.sendUpstream(evt);
  }
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
exports.InetAddress = InetAddress;
exports.SocketServer = SocketServer;
