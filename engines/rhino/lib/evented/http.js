var {ChannelBuffers} = org.jboss.netty.buffer;
var {Channels,
     ChannelFutureListener,
     ChannelUpstreamHandler} = org.jboss.netty.channel;
var {DefaultHttpChunk,
     DefaultHttpRequest,
     DefaultHttpResponse,
     HttpChunk,
     HttpContentCompressor,
     HttpContentDecompressor,
     HttpClientCodec,
     HttpHeaders,
     HttpMethod,
     HttpRequest,
     HttpRequestDecoder,
     HttpResponse,
     HttpResponseEncoder,
     HttpResponseStatus,
     HttpVersion,
     QueryStringDecoder,
     QueryStringEncoder} = org.jboss.netty.handler.codec.http;
var {CharsetUtil} = org.jboss.netty.util;

var {extend} = require('objects');
var {SocketEndpoint,
     SocketClient,
     SocketConnection,
     SocketServer} = require('evented');

/**
 * (Internal) Return path and params for a Netty HttpRequest.
 *
 * @returns an array consisting of a path and params hash
 */
function getPathAndParams(request) {
  var decoder = new QueryStringDecoder(request.uri);
  var path = String(decoder.path);
  var params = {};
  for each (var entry in Iterator(decoder.parameters.entrySet())) {
    params[entry.key] = String(entry.value.get(0));
  }
  return [path, params];
}

/**
 * (Internal) Return headers for a Netty HttpRequest or HttpResponse.
 *
 * @returns a headers hash
 */
function getHeaders(request) {
  var headers = {};
  for each (var entry in Iterator(request.headers)) {
    headers[entry.key.toLowerCase()] = String(entry.value);
  }
  return headers;
}

/**
 * (Internal) Return a read-only view of a Netty HttpRequest.
 *
 * @returns a request
 */
function wrapRequest(request) {
  var method = String(request.method.name);
  var uri = String(request.uri);
  var [path, params] = getPathAndParams(request);
  var headers = getHeaders(request);
  var content = String(request.content.toString(CharsetUtil.UTF_8));
  var chunked = request.chunked;

  return {
    method:   method,
    uri:      uri,
    path:     path,
    params:   params,
    headers:  headers,
    content:  content,
    chunked:  chunked
  };
}

/**
 * (Internal) Convert an object into a Netty HttpRequest.
 *
 * TODO: refactor!
 *
 * @returns an HttpRequest
 */
function unwrapRequest(object) {
  var uri = object.uri;
  if (!uri) {
    var encoder = new QueryStringEncoder(object.path);
    for each (var param in Object.keys(object.params)) {
      encoder.addParam(param, String(object.params[param]));
    }
    uri = encoder.toString();
  }

  var request = new DefaultHttpRequest(HttpVersion.HTTP_1_1, HttpMethod.valueOf(object.method), uri);
  for each (var k in Object.keys(object.headers || {})) {
    request.addHeader(k, object.headers[k]);
  }

  if (object.chunked) {
    request.chunked = true;
  } else {
    request.chunked = false;
    if (object.content) {
      request.content = ChannelBuffers.wrappedBuffer(object.content.toByteArray());
    }
    HttpHeaders.setContentLength(request, request.content.readableBytes());
  }

  return request;
}

/**
 * (Internal) Return a read-only view of a Netty HttpResponse.
 *
 * @returns a response
 */
function wrapResponse(response) {
  var status = parseInt(response.status.code);
  var version = String(response.protocolVersion.text);
  var headers = getHeaders(response);
  var content = String(response.content.toString(CharsetUtil.UTF_8));
  var chunked = response.chunked;

  return {
    status:   status,
    version:  version,
    headers:  headers,
    content:  content,
    chunked:  chunked
  };
}

/**
 * (Internal) Convert an object into a Netty HttpResponse.
 *
 * TODO: refactor!
 *
 * @returns an HttpResponse
 */
function unwrapResponse(object) {
  var response = new DefaultHttpResponse(HttpVersion.HTTP_1_1, HttpResponseStatus.valueOf(object.status));
  for each (var k in Object.keys(object.headers || {})) {
    response.addHeader(k, object.headers[k]);
  }

  if (object.chunked) {
    response.chunked = true;
  } else {
    response.chunked = false;
    response.content = ChannelBuffers.wrappedBuffer(object.content.toByteArray());
    HttpHeaders.setContentLength(response, response.content.readableBytes());
  }

  return response;
}

/**
 * (Internal) Return a read-only view of a Netty HttpChunk.
 *
 * @returns a chunk
 */
function wrapChunk(chunk) {
  var headers;
  var content = String(chunk.content.toString(CharsetUtil.UTF_8));
  var last = chunk.last;
  if (last) {
    headers = getHeaders(chunk);
  }

  return {
    headers:  headers,
    content:  content,
    last:     last
  };
}

/**
 * (Internal) Convert an object into a Netty HttpChunk.
 *
 * @returns an HttpChunk
 */
function unwrapChunk(object) {
  return new DefaultHttpChunk(ChannelBuffers.wrappedBuffer(object.content.toByteArray()));
}

/**
 * (Internal) Wrap a Netty channel.
 */
function HttpConnection(channel, options) {
  SocketConnection.call(this, channel, options);
  this.started = false;
}

extend(HttpConnection, SocketConnection);

/**
 * Write a chunk of data to the HTTP client.
 *
 * @returns a write promise
 */
HttpConnection.prototype.write = function (data) {
  var msg;
  if (this.started) {
    msg = unwrapChunk(data);
  } else {
    msg = (this.options.mode == 'client' ? unwrapRequest : unwrapResponse)(data);
    this.started = true;
  }
  return this.wrapFuture(this.channel.write(msg));
};

/**
 * Construct a new HTTP server with a sensible Netty ChannelPipelineFactory.
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

extend(HttpServer, SocketServer);

/**
 * (Internal) Creates the proper Netty ChannelPipeline for an HTTP server.
 *
 * @returns a new pipeline
 */
HttpServer.prototype.createPipeline = function () {
  var pipeline = Channels.pipeline();
  pipeline.addLast('decoder', new HttpRequestDecoder());
  pipeline.addLast('encoder', new HttpResponseEncoder());
  if (this.options.compress) {
    pipeline.addLast('deflater', new HttpContentCompressor());
  }
  pipeline.addLast('handler', new ChannelUpstreamHandler({
    handleUpstream: this.dispatchUpstreamEvent.bind(this)
  }));
  return pipeline;
};

/**
 * (Internal) Handle a Netty MessageEvent. Here, we determine whether the message is a HttpRequest or an
 * HttpChunk, and then wrap appropriately.
 */
HttpServer.prototype.handleMessage = function (ctx, evt) {
  var conn = this.wrapConnection(ctx.channel);
  var message = evt.message;
  if (message instanceof HttpRequest) {
    this.notify('request', conn, wrapRequest(message));
  } else if (message instanceof HttpChunk) {
    this.notify('chunk', conn, wrapChunk(message));
  }
};

/**
 * (Internal) Wraps the Netty Channel in an HttpConnection.
 *
 * We make this polymorphic so that we can handle open/bind/connect events at the socket level, while
 * still providing the correct connection type to the client.
 *
 * @returns an HTTP connection
 */
HttpServer.prototype.wrapConnection = function (channel) {
  return new HttpConnection(channel, { mode: 'server' });
};

/**
 * Construct a new HTTP client with a sensible Netty ChannelPipelineFactory.
 *
 * Options:
 *  host
 *  port
 *  compress
 *
 * @returns a new HTTP client
 */
function HttpClient(options) {
  SocketClient.call(this, options);
  this.bootstrap.pipelineFactory = this.createPipeline.bind(this);
}

extend(HttpClient, SocketClient);

/**
 * Connect the client to a server at the specified host and port.
 */
HttpClient.prototype.request = function (object) {
  this.connect().then(function (conn) {
    conn.write(object);
  });
};

/**
 * (Internal) Creates the proper Netty ChannelPipeline for an HTTP client.
 *
 * @returns a new pipeline
 */
HttpClient.prototype.createPipeline = function () {
  var pipeline = Channels.pipeline();
  pipeline.addLast('codec', new HttpClientCodec());
  pipeline.addLast('inflater', new HttpContentDecompressor());
  pipeline.addLast('handler', new ChannelUpstreamHandler({
    handleUpstream: this.dispatchUpstreamEvent.bind(this)
  }));
  return pipeline;
};

/**
 * (Internal) Handle a Netty MessageEvent. Here, we determine whether the message is a HttpResponse or an
 * HttpChunk, and then wrap appropriately.
 */
HttpClient.prototype.handleMessage = function (ctx, evt) {
  var conn = this.wrapConnection(ctx.channel);
  var message = evt.message;
  if (message instanceof HttpResponse) {
    this.notify('response', conn, wrapResponse(message));
  } else if (message instanceof HttpChunk) {
    this.notify('chunk', conn, wrapChunk(message));
  }
};

/**
 * (Internal) Wraps the Netty Channel in an HttpConnection.
 *
 * We make this polymorphic so that we can handle open/bind/connect events at the socket level, while
 * still providing the correct connection type to the client.
 *
 * @returns an HTTP connection
 */
HttpClient.prototype.wrapConnection = function (channel) {
  return new HttpConnection(channel, { mode: 'client' });
};

/**
 * Module exports.
 */
exports.HttpConnection = HttpConnection;
exports.HttpClient = HttpClient;
exports.HttpServer = HttpServer;
