importPackage(java.io);
importPackage(java.net);
importPackage(java.util.concurrent);

importPackage(org.jboss.netty.bootstrap);
importPackage(org.jboss.netty.channel.socket.nio);

require('binary'); // lots of stuff that we need for byte streams

var {EventManager} = require('evented/eventmanager');

export('SocketServer');

function SocketServer(options) {
  this.options = options;
  this.bootstrap = new ServerBootstrap(
    new NioServerSocketChannelFactory(
      Executors.newCachedThreadPool(),
      Executors.newCachedThreadPool()));
}

/**
 * Mixin EventManager to get subscribe/notify behavior
 */
SocketServer.prototype.listen = EventManager.listen;
SocketServer.prototype.notify = EventManager.notify;

SocketServer.prototype.start = function () {
  this.bootstrap.bind(new InetSocketAddress(this.options.port));
};
