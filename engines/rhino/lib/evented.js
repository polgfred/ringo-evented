importPackage(java.io);
importPackage(java.net);
importPackage(java.util.concurrent);

importPackage(org.jboss.netty.bootstrap);
importPackage(org.jboss.netty.channel.socket.nio);

require('binary'); // lots of stuff that we need for byte streams

var {EventManager} = require('eventmanager');

/**
 * Wrap a java.net.InetAddress object.
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
 * Create a new generic server.
 */
function SocketServer(options) {
  this.options = options;
  this.bootstrap = new ServerBootstrap(
    new NioServerSocketChannelFactory(
      Executors.newCachedThreadPool(),
      Executors.newCachedThreadPool()));
}

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

exports.InetAddress = InetAddress;
exports.SocketServer = SocketServer;
