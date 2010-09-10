var {InetSocketAddress} = java.net;
var {Executors} = java.util.concurrent;

var {ClientBootstrap,
     ServerBootstrap} = org.jboss.netty.bootstrap;
var {ChannelFutureListener,
     ChannelLocal,
     ChannelState,
     ChannelStateEvent,
     ExceptionEvent,
     MessageEvent} = org.jboss.netty.channel;
var {NioClientSocketChannelFactory,
     NioServerSocketChannelFactory} = org.jboss.netty.channel.socket.nio;

// stuff that we need for byte streams
require('binary');

var {Class} = require('class');
var {EventManager} = require('eventmanager');

/**
 * Create a new generic socket endpoint. (You probably won't ever call this directly.)
 *
 * @returns a new endpoint
 */
var SocketEndpoint = Class.create(function (options) {
  this.options = options || {};
});

/**
 * (Internal) Dispatch socket-level events to the SocketEndpoint's event listener.
 */
SocketEndpoint.define('dispatchUpstreamEvent', function (ctx, evt) {
  if (evt instanceof ChannelStateEvent) {
    this.handleStateChange(ctx, evt);
  } else if (evt instanceof MessageEvent) {
    this.handleMessage(ctx, evt);
  } else if (evt instanceof ExceptionEvent) {
    this.handleError(ctx, evt);
  }
});

/**
 * (Internal) Handle a Netty ChannelStateEvent.
 */
SocketEndpoint.define('handleStateChange', function (ctx, evt) {
  var conn = this.wrapChannel(ctx.channel);

  if (evt.state == ChannelState.OPEN) {
    this.notify(evt.value ? 'open' : 'close', conn);
  } else if (evt.state == ChannelState.BOUND) {
    this.notify(evt.value ? 'bind' : 'unbind', conn);
  } else if (evt.state == ChannelState.CONNECTED) {
    this.notify(evt.value ? 'connect' : 'disconnect', conn);
  }
});

/**
 * (Internal) Handle a Netty MessageEvent. Server subtypes need to override this, as it does nothing.
 */
SocketEndpoint.define('handleMessage', function (ctx, evt) {
});

/**
 * (Internal) Handle a Netty ExceptionEvent. Server subtypes can be smarter about this if they wish.
 */
SocketEndpoint.define('handleError', function (ctx, evt) {
  var conn = this.wrapChannel(ctx.channel);

  this.notify('error', conn, evt.cause);
});

/**
 * Mixin EventManager to get subscribe/notify behavior.
 */
SocketEndpoint.include(EventManager);

/**
 * Create a new generic server.
 *
 * @returns a new server
 */
var SocketServer = SocketEndpoint.extend(function (options) {
  this.super(options);

  this.bootstrap = new ServerBootstrap(
    new NioServerSocketChannelFactory(
      Executors.newCachedThreadPool(),
      Executors.newCachedThreadPool()));
});

/**
 * Start the server by binding to the specified port.
 */
SocketServer.define('start', function () {
  this.bootstrap.bind(new InetSocketAddress(this.options.port));
});

/**
 * Create a new generic client.
 *
 * @returns a new client
 */
var SocketClient = SocketEndpoint.extend(function (options) {
  this.super(options);

  this.bootstrap = new ClientBootstrap(
    new NioClientSocketChannelFactory(
      Executors.newCachedThreadPool(),
      Executors.newCachedThreadPool()));
});

/**
 * Connect to a remote server on the specified host and port.
 *
 * @returns a connect promise
 */
SocketClient.define('connect', function () {
  var future = this.bootstrap.connect(new InetSocketAddress(this.options.host, this.options.port));

  return this.wrapChannel(future.channel).wrapFuture(future);
});

/**
 * Create a new generic Connection.
 *
 * @returns the new connection
 */
var SocketConnection = Class.create(function (channel, options) {
  this.channel = channel;
  this.options = options;

  if (channel.remoteAddress) {
    this.remoteAddress = this.wrapAddress(channel.remoteAddress);
  }
  if (channel.localAddress) {
    this.localAddress = this.wrapAddress(channel.localAddress);
  }
});

/**
 * (Internal) A ChannelLocal which maintains a persistent attributes hash for each channel.
 */
var connectionAttributes = JavaAdapter(ChannelLocal, {
  initialValue: function () {
    return {};
  }
});

/**
 * Access this connection's attributes hash.
 *
 * @returns an attributes hash
 */
SocketConnection.prototype.__defineGetter__('attributes', function () {
  return connectionAttributes.get(this.channel);
});

/**
 * Wrap a java.net.InetAddress object.
 *
 * @returns an internet address
 */
SocketConnection.define('wrapAddress', function (addr) {
  var hostname = String(addr.hostName);
  var address = String(addr.hostAddress);

  return {
    hostname: hostname,
    address:  address
  };
});

/**
 * Return a connect promise for the Netty ChannelFuture.
 *
 * @returns a connect promise
 */
SocketConnection.define('wrapFuture', function (future) {
  var self = this;

  return {
    then: function (continuation) {
      future.addListener(new ChannelFutureListener({
        operationComplete: function () {
          continuation(self);
        }
      }));
    },
    thenClose: function () {
      future.addListener(ChannelFutureListener.CLOSE);
    }
  };
});

/**
 * Module exports.
 */
exports.SocketEndpoint   = SocketEndpoint;
exports.SocketClient     = SocketClient;
exports.SocketServer     = SocketServer;
exports.SocketConnection = SocketConnection;
