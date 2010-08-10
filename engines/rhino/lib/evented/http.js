importPackage(org.jboss.netty.buffer);
importPackage(org.jboss.netty.channel);
importPackage(org.jboss.netty.handler.codec.http);

var {InetAddress, SocketServer} = require('evented');

/**
 * Wrap a Netty channel.
 */
function HttpConnection(channel) {
  this.channel = channel;
  this.remoteAddress = InetAddress(channel.remoteAddress);
  this.localAddress = InetAddress(channel.localAddress);
}

/**
 * (Internal) Wrap a Netty ChannelFuture in a CommonJS promise.
 *
 * @returns a write promise
 */
HttpConnection.prototype.wrapFuture = function (future) {
  return {
    then: function (continuation) {
      future.addListener(new ChannelFutureListener({ operationComplete: continuation }));
    },
    thenClose: function () {
      future.addListener(ChannelFutureListener.CLOSE);
    }
  };
};

/**
 * Begin a conversation with an HTTP client by providing the response status code and HTTP headers.
 *
 * @returns a write promise for the message
 */
HttpConnection.prototype.start = function (status, headers) {
  var msg = new DefaultHttpResponse(HttpVersion.HTTP_1_1, HttpResponseStatus.valueOf(status));
  for each (var k in Object.keys(headers || {})) {
    msg.addHeader(k, headers[k]);
  }
  msg.chunked = true;
  return this.wrapFuture(this.channel.write(msg));
};

/**
 * Write a chunk of data to the HTTP client.
 *
 * @returns a write promise for the message
 */
HttpConnection.prototype.write = function (data) {
  var msg = new DefaultHttpChunk(ChannelBuffers.wrappedBuffer(data.toByteArray()));
  return this.wrapFuture(this.channel.write(msg));
};

/**
 * Construct a new HTTP server with a sensible Netty ChannelPipelineFactory. See #createPipeline.
 *
 * @returns a new HTTP server
 */
function HttpServer(options) {
  SocketServer.call(this, options);
  this.bootstrap.pipelineFactory = this.createPipeline.bind(this);
}

// (Internal) prototype chaining.
HttpServer.prototype = (function () {
  var proto = function () {};
  proto.prototype = SocketServer.prototype;
  return new proto();
}());

/**
 * (Internal) Creates a Netty ChannelPipeline that decodes/encodes HTTP and dispatches channel events
 * to the HttpServer's event listener.
 *
 * @returns a new ChannelPipeline
 */
HttpServer.prototype.createPipeline = function () {
  return Channels.pipeline(
    new HttpRequestDecoder(),
    new HttpResponseEncoder(),
    new ChannelUpstreamHandler({
      handleUpstream: this.dispatchUpstreamEvent.bind(this)
    }));
};

/**
 * (Internal) Wraps the Netty ChannelHandlerContext's Channel in an HttpConnection.
 *
 * We make this polymorphic so that we can handle open/bind/connect events at the socket level, while
 * still providing the correct connection type to the client.
 *
 * @returns an HTTP client
 */
HttpServer.prototype.wrapConnection = function (channel) {
  return new HttpConnection(channel);
};

/**
 * (Internal) Convert the HTTP message body into a properly encoded JavaScript string.
 *
 * @returns the message string
 */
HttpServer.prototype.convertMessage = function (message) {
  return String(message.content.toString('UTF8'));
};

/**
 * Module exports.
 */
exports.HttpServer = HttpServer;
