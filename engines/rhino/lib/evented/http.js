importPackage(org.jboss.netty.buffer);
importPackage(org.jboss.netty.channel);
importPackage(org.jboss.netty.handler.codec.http);
importPackage(org.jboss.netty.util);

var {SocketServer} = require('evented');

/**
 * (Internal) Wrap a Netty channel.
 */
function HttpConnection(channel) {
  this.channel = channel;
  this.remoteAddress = this.wrapAddress(channel.remoteAddress);
  this.localAddress = this.wrapAddress(channel.localAddress);
}

/**
 * Wrap a java.net.InetAddress object.
 *
 * @returns an internet address
 */
HttpConnection.prototype.wrapAddress = function (addr) {
  var hostname = String(addr.hostName);
  var address = String(addr.hostAddress);

  return {
    get hostname() { return hostname; },
    get address()  { return address;  }
  };
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
 * Options:
 *  port
 *  compress
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
  var pipeline = Channels.pipeline();
  pipeline.addLast('decoder', new HttpRequestDecoder());
  pipeline.addLast('encoder', new HttpResponseEncoder());
  if (this.options.compress)
    pipeline.addLast('deflater', new HttpContentCompressor());
  pipeline.addLast('handler', new ChannelUpstreamHandler({
    handleUpstream: this.dispatchUpstreamEvent.bind(this)
  }));
  return pipeline;
};

/**
 * (Internal) Intercept and handle HTTP messages.
 */
HttpServer.prototype.dispatchUpstreamEvent = function (ctx, evt) {
  if (evt instanceof MessageEvent) {
    var message = evt.message;
    if (message instanceof HttpRequest) {
      this.notify('request', this.wrapConnection(ctx.channel), this.wrapHttpRequest(message));
    } else if (message instanceof HttpChunk) {
      this.notify('chunk', this.wrapConnection(ctx.channel), this.wrapHttpChunk(message));
    }
  } else {
    SocketServer.prototype.dispatchUpstreamEvent.call(this, ctx, evt);
  }
};

/**
 * (Internal) Return path and params for a Netty HttpRequest.
 *
 * @returns an array consisting of a path and params hash
 */
HttpServer.prototype.getHttpPathAndParams = function (request) {
  var decoder = new QueryStringDecoder(request.uri);
  var path = String(decoder.path);
  var params = {};
  for each (var entry in Iterator(decoder.parameters.entrySet())) {
    params[entry.key] = String(entry.value.get(0));
  }
  return [path, params];
};

/**
 * (Internal) Return headers for a Netty HttpRequest or HttpChunkTrailer.
 *
 * @returns a headers hash
 */
HttpServer.prototype.getHttpHeaders = function (request) {
  var headers = {};
  for each (var entry in Iterator(request.headers)) {
    headers[entry.key.toLowerCase()] = String(entry.value);
  }
  return headers;
};

/**
 * (Internal) Return a read-only view of a Netty HttpRequest.
 *
 * @returns a request
 */
HttpServer.prototype.wrapHttpRequest = function (request) {
  var method = String(request.method.name);
  var uri = String(request.uri);
  var [path, params] = this.getHttpPathAndParams(request);
  var headers = this.getHttpHeaders(request);
  var content = String(request.content.toString(CharsetUtil.UTF_8));
  var chunked = request.chunked;

  return {
    get method()  { return method;  },
    get uri()     { return uri;     },
    get path()    { return path;    },
    get params()  { return params;  },
    get headers() { return headers; },
    get content() { return content; },
    get chunked() { return chunked; }
  };
};

/**
 * (Internal) Return a read-only view of a Netty HttpChunk.
 *
 * @returns a chunk
 */
HttpServer.prototype.wrapHttpChunk = function (chunk) {
  var content = String(chunk.content.toString(CharsetUtil.UTF_8));
  var last = chunk.last;

  return {
    get content() { return content; },
    get last()    { return last;    }
  };
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
HttpServer.prototype.wrapMessage = function (message) {
  return String(message.content.toString(CharsetUtil.UTF_8));
};

/**
 * Module exports.
 */
exports.HttpConnection = HttpConnection;
exports.HttpServer = HttpServer;
