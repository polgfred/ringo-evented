importPackage(org.jboss.netty.buffer);
importPackage(org.jboss.netty.channel);
importPackage(org.jboss.netty.handler.codec.http);

var {SocketListener, SocketServer} = require('evented');

export('HttpConnection', 'HttpServer');

function HttpConnection(channel) {
  this.channel = channel;
  this.remoteAddr = channel.remoteAddress.hostName;
  this.localAddr = channel.localAddress.hostName;
};

HttpConnection.CLOSE = function () {
  this.channel.close();
};

HttpConnection.prototype.start = function (status, headers) {
  var msg = new DefaultHttpResponse(
    HttpVersion.HTTP_1_1,
    HttpResponseStatus.valueOf(status));

  msg.chunked = true;
  for (var k in headers) {
    msg.addHeader(k, headers[k]);
  }
  this.channel.write(msg);
};

HttpConnection.prototype.write = function (data, cb) {
  var msg = new DefaultHttpChunk(ChannelBuffers.wrappedBuffer(data.toByteArray()));
  var future = this.channel.write(msg);
  if (cb) {
    future.addListener(new ChannelFutureListener({ operationComplete: cb.bind(this) }));
  }
};

function HttpServer(options) {
  SocketServer.call(this, options);
  this.listener = new SocketListener();
  this.bootstrap.pipelineFactory = this.createPipeline.bind(this);
}

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
  var listener = this.listener;
  var conn = new HttpConnection(ctx.channel);

  if (evt instanceof ChannelStateEvent) {
    if (evt.state == ChannelState.OPEN) {
      listener.notify(evt.value ? 'open' : 'close', conn);
    } else if (evt.state == ChannelState.BOUND) {
      listener.notify(evt.value ? 'bind' : 'unbind', conn);
    } else if (evt.state == ChannelState.CONNECTED) {
      listener.notify(evt.value ? 'connect' : 'disconnect', conn);
    } else {
      ctx.sendUpstream(evt);
    }
  } else if (evt instanceof MessageEvent) {
    listener.notify('data', conn, evt.message.content.toString('UTF8'));
  } else if (evt instanceof ExceptionEvent) {
    listener.notify('error', conn, evt);
  } else {
    ctx.sendUpstream(evt);
  }
};
