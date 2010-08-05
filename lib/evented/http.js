importPackage(org.jboss.netty.buffer);
importPackage(org.jboss.netty.channel);
importPackage(org.jboss.netty.handler.codec.http);

var {defer} = require('ringo/promise');

var {SocketListener, SocketServer} = require('evented');

export('HttpServer');

function HttpConnection(channel) {
  this.channel = channel;
  this.remoteAddr = channel.remoteAddress.hostName;
  this.localAddr = channel.localAddress.hostName;
};

HttpConnection.prototype.futureToPromise = function (future) {
  var conn = this;
  var deferred = defer();
  future.addListener(new ChannelFutureListener({
    operationComplete: function () {
      deferred.resolve(conn);
    }
  }));
  return deferred.promise;
};

HttpConnection.prototype.start = function (status, headers) {
  var msg = new DefaultHttpResponse(
    HttpVersion.HTTP_1_1,
    HttpResponseStatus.valueOf(status));
  for each (var k in Object.keys(headers)) {
    msg.addHeader(k, headers[k]);
  }
  msg.chunked = true;
  return this.futureToPromise(this.channel.write(msg));
};

HttpConnection.prototype.write = function (data) {
  var msg = new DefaultHttpChunk(
    ChannelBuffers.wrappedBuffer(data.toByteArray()));
  return this.futureToPromise(this.channel.write(msg));
};

function HttpServer(options) {
  SocketServer.call(this, options);
  this.bootstrap.pipelineFactory = this.createPipeline.bind(this);
}

HttpServer.CLOSE_CONNECTION = function (conn) {
  conn.channel.close();
};

HttpServer.prototype = (function () {
  var proto = function () {};
  proto.prototype = SocketServer.prototype;
  return new proto();
}());

HttpServer.prototype.createPipeline = function () {
  return Channels.pipeline(
    new HttpRequestDecoder(),
    new HttpResponseEncoder(),
    new ChannelUpstreamHandler({
      handleUpstream: this.dispatchUpstreamEvent.bind(this)
    }));
};

HttpServer.prototype.dispatchUpstreamEvent = function (ctx, evt) {
  var conn = new HttpConnection(ctx.channel);

  if (evt instanceof ChannelStateEvent) {
    if (evt.state == ChannelState.OPEN) {
      this.notify(evt.value ? 'open' : 'close', conn);
    } else if (evt.state == ChannelState.BOUND) {
      this.notify(evt.value ? 'bind' : 'unbind', conn);
    } else if (evt.state == ChannelState.CONNECTED) {
      this.notify(evt.value ? 'connect' : 'disconnect', conn);
    } else {
      ctx.sendUpstream(evt);
    }
  } else if (evt instanceof MessageEvent) {
    this.notify('data', conn, evt.message.content.toString('UTF8'));
  } else if (evt instanceof ExceptionEvent) {
    this.notify('error', conn, evt);
  } else {
    ctx.sendUpstream(evt);
  }
};
