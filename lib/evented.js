importPackage(java.io);
importPackage(java.net);
importPackage(java.util.concurrent);

importPackage(org.jboss.netty.bootstrap);
importPackage(org.jboss.netty.channel.socket.nio);

require('binary'); // lots of stuff that we need for byte streams

export('SocketListener', 'SocketServer');

function SocketListener() {
  this.cb = {};
}

SocketListener.prototype.listen = function (evt, callback) {
  if (typeof evt === 'object') {
    for (var ev in evt) {
      this.listen(ev, evt[ev]);
    }
  } else {
    this.cb[evt] = this.cb[evt] || [];
    this.cb[evt].push(callback);
  }
};

SocketListener.prototype.notify = function (evt) {
  var args = Array.prototype.slice.call(arguments, 1);
  var callbacks = this.cb[evt];
  if (callbacks) {
    for (var i = 0; i < callbacks.length; ++i) {
      callbacks[i].apply(this, args);
    }
  }
};

function SocketServer(options) {
  this.options = options;
  this.bootstrap = new ServerBootstrap(
    new NioServerSocketChannelFactory(
      Executors.newCachedThreadPool(),
      Executors.newCachedThreadPool()));
}

SocketServer.prototype.listen = function (evt, callback) {
  this.listener.listen(evt, callback);
};

SocketServer.prototype.start = function () {
  this.bootstrap.bind(new InetSocketAddress(this.options.port));
};
