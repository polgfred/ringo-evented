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
     HttpServerCodec,
     HttpHeaders,
     HttpMethod,
     HttpRequest,
     HttpResponse,
     HttpResponseStatus,
     HttpVersion,
     QueryStringDecoder,
     QueryStringEncoder} = org.jboss.netty.handler.codec.http;
var {CharsetUtil} = org.jboss.netty.util;

var {Class} = require('class');
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
 * (Internal) Calculate the URI from a data object consisting of either uri, or path and params.
 *
 * @returns a uri
 */
function getUri(data) {
  var uri = data.uri;

  if (!uri) {
    var encoder = new QueryStringEncoder(data.path);
    for each (var param in Object.keys(data.params || {})) {
      encoder.addParam(param, String(data.params[param]));
    }
    uri = encoder.toString();
  }

  return uri;
}

/**
 * (Internal) Put the headers from a data object into a Netty HttpRequest or HttpResponse.
 */
function putHeaders(message, data) {
  for each (var k in Object.keys(data.headers || {})) {
    message.addHeader(k, data.headers[k]);
  }
}

/**
 * (Internal) Put the content from a data object into a Netty HttpRequest or HttpResponse.
 */
function putContent(message, data) {
  if (data.chunked) {
    message.chunked = true;
  } else {
    message.chunked = false;
    if (data.content) {
      message.content = ChannelBuffers.wrappedBuffer(data.content.toByteArray());
    }
    HttpHeaders.setContentLength(message, message.content.readableBytes());
  }
}

/**
 * (Internal) Convert a Netty HttpRequest into a data object.
 *
 * @returns a request object
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
 * (Internal) Convert a data object into a Netty HttpRequest.
 *
 * @returns an HttpRequest
 */
function unwrapRequest(data) {
  var request = new DefaultHttpRequest(
    HttpVersion.HTTP_1_1,
    HttpMethod.valueOf(data.method),
    getUri(data));

  putHeaders(request, data);
  putContent(request, data);

  return request;
}

/**
 * (Internal) Convert a Netty HttpResponse into a data object.
 *
 * @returns a response object
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
 * (Internal) Convert a data object into a Netty HttpResponse.
 *
 * @returns an HttpResponse
 */
function unwrapResponse(data) {
  var response = new DefaultHttpResponse(
    HttpVersion.HTTP_1_1,
    HttpResponseStatus.valueOf(data.status));

  putHeaders(response, data);
  putContent(response, data);

  return response;
}

/**
 * (Internal) Convert a Netty HttpChunk into a data object.
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
 * (Internal) Convert a data object into a Netty HttpChunk.
 *
 * @returns an HttpChunk
 */
function unwrapChunk(data) {
  return new DefaultHttpChunk(ChannelBuffers.wrappedBuffer(data.content.toByteArray()));
}

/**
 * Construct a new HTTP connection that wraps a Netty Channel.
 */
var HttpConnection = SocketConnection.extend(function (channel, options) {
  this.super(channel, options);
});

/**
 * Write some data to the HTTP connection.
 *
 * @returns a write promise
 */
HttpConnection.define('write', function (data) {
  var msg;
  
  if (this.options.mode == 'client' && data.method) {
    msg = unwrapRequest(data);
  } else if (this.options.mode == 'server' && data.status) {
    msg = unwrapResponse(data);
  } else {
    msg = unwrapChunk(data);
  }

  return this.wrapFuture(this.channel.write(msg));
});

/**
 * Construct a new HTTP server with a sensible Netty ChannelPipelineFactory.
 *
 * Options:
 *  port
 *  compress
 *
 * @returns a new HTTP server
 */
var HttpServer = SocketServer.extend(function (options) {
  this.super(options);

  this.bootstrap.pipelineFactory = this.createPipeline.bind(this);
});

/**
 * (Internal) Creates the proper Netty ChannelPipeline for an HTTP server.
 *
 * @returns a new pipeline
 */
HttpServer.define('createPipeline', function () {
  var pipeline = Channels.pipeline();

  pipeline.addLast('codec', new HttpServerCodec());
  if (this.options.compress) {
    pipeline.addLast('deflater', new HttpContentCompressor());
  }
  pipeline.addLast('handler', new ChannelUpstreamHandler({
    handleUpstream: this.dispatchUpstreamEvent.bind(this)
  }));

  return pipeline;
});

/**
 * (Internal) Handle a Netty MessageEvent. Here, we determine whether the message is a HttpRequest or an
 * HttpChunk, and then wrap appropriately.
 */
HttpServer.define('handleMessage', function (ctx, evt) {
  var conn = this.wrapChannel(ctx.channel);
  var message = evt.message;

  if (message instanceof HttpRequest) {
    this.notify('request', conn, wrapRequest(message));
  } else if (message instanceof HttpChunk) {
    this.notify('chunk', conn, wrapChunk(message));
  }
});

/**
 * (Internal) Wraps the Netty Channel in an HttpConnection.
 *
 * We make this polymorphic so that we can handle open/bind/connect events at the socket level, while
 * still providing the correct connection type to the client.
 *
 * @returns an HTTP connection
 */
HttpServer.define('wrapChannel', function (channel) {
  return new HttpConnection(channel, { mode: 'server' });
});

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
var HttpClient = SocketClient.extend(function (options) {
  this.super(options);

  this.bootstrap.pipelineFactory = this.createPipeline.bind(this);
});

/**
 * Connect the client to a server at the specified host and port.
 */
HttpClient.define('request', function (object) {
  this.connect().then(function (conn) {
    conn.write(object);
  });
});

/**
 * (Internal) Creates the proper Netty ChannelPipeline for an HTTP client.
 *
 * @returns a new pipeline
 */
HttpClient.define('createPipeline', function () {
  var pipeline = Channels.pipeline();

  pipeline.addLast('codec', new HttpClientCodec());
  pipeline.addLast('inflater', new HttpContentDecompressor());
  pipeline.addLast('handler', new ChannelUpstreamHandler({
    handleUpstream: this.dispatchUpstreamEvent.bind(this)
  }));

  return pipeline;
});

/**
 * (Internal) Handle a Netty MessageEvent. Here, we determine whether the message is a HttpResponse or an
 * HttpChunk, and then wrap appropriately.
 */
HttpClient.define('handleMessage', function (ctx, evt) {
  var conn = this.wrapChannel(ctx.channel);
  var message = evt.message;

  if (message instanceof HttpResponse) {
    this.notify('response', conn, wrapResponse(message));
  } else if (message instanceof HttpChunk) {
    this.notify('chunk', conn, wrapChunk(message));
  }
});

/**
 * (Internal) Wraps the Netty Channel in an HttpConnection.
 *
 * We make this polymorphic so that we can handle open/bind/connect events at the socket level, while
 * still providing the correct connection type to the client.
 *
 * @returns an HTTP connection
 */
HttpClient.define('wrapChannel', function (channel) {
  return new HttpConnection(channel, { mode: 'client' });
});

/**
 * Module exports.
 */
exports.HttpConnection = HttpConnection;
exports.HttpClient     = HttpClient;
exports.HttpServer     = HttpServer;
