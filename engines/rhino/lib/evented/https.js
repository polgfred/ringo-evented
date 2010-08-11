importPackage(java.io);
importPackage(java.security);
importPackage(javax.net.ssl);

importPackage(org.jboss.netty.buffer);
importPackage(org.jboss.netty.channel);
importPackage(org.jboss.netty.handler.codec.http);
importPackage(org.jboss.netty.handler.ssl);

var JString = java.lang.String;

var fs = require('fs');

var {InetAddress, SocketServer} = require('evented');
var {HttpConnection, HttpServer} = require('evented/http');

/**
 * Construct a new HTTPS server with a sensible Netty ChannelPipelineFactory. See #createPipeline.
 *
 * @returns a new HTTPS server
 */
function HttpsServer(options) {
  HttpServer.call(this, options);
}

// (Internal) prototype chaining.
HttpsServer.prototype = (function () {
  var proto = function () {};
  proto.prototype = HttpServer.prototype;
  return new proto();
}());

// (Internal) Set up SSL.
HttpsServer.sslConfig = {
  keyFile: 'ringossl.jks',
  password: JString('ringossl').toCharArray()
};

HttpsServer.sslContext = (function () {
  var keyPath = fs.join(fs.directory(module.path), HttpsServer.sslConfig.keyFile);
  var keyStore = KeyStore.getInstance('JKS');
  keyStore.load(new FileInputStream(keyPath), HttpsServer.sslConfig.password);
  var keyMgrFactory = KeyManagerFactory.getInstance('SunX509');
  keyMgrFactory.init(keyStore, HttpsServer.sslConfig.password);
  var sslContext = SSLContext.getInstance('TLS');
  sslContext.init(keyMgrFactory.keyManagers, null, null);
  return sslContext;
}());

/**
 * (Internal) Same as HttpServer's #createPipeline, except adds an SslHandler to the front.
 *
 * @returns a new ChannelPipeline
 */
HttpsServer.prototype.createPipeline = function () {
  var engine = HttpsServer.sslContext.createSSLEngine();
  engine.useClientMode = false;

  return Channels.pipeline(
    new SslHandler(engine),
    new HttpRequestDecoder(),
    new HttpResponseEncoder(),
    new ChannelUpstreamHandler({
      handleUpstream: this.dispatchUpstreamEvent.bind(this)
    }));
};

/**
 * Module exports.
 */
exports.HttpsServer = HttpsServer;
