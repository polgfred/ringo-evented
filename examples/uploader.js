include('evented/http');

var server = new HttpServer({ port: 4321 });

server.listen({
  connect: function (conn) {
    print('\nconnection from', conn.remoteAddress.hostname);
    conn.start(200, { 'content-type': 'text/plain' });
  },
  request: function (conn, request) {
    if (request.chunked) {
      print('this request is chunked, data follows');
    } else {
      print('this request is not chunked');
      conn.write('received ' + String(request.content.length) + ' chars\n');
      conn.write('goodbye!\n').thenClose();
    }
  },
  chunk: function (conn, chunk) {
    print('chunk received');
    if (chunk.last) {
      print('that was the last chunk, no more data');
      conn.write('goodbye!\n').thenClose();
    } else {
      conn.write('received ' + String(chunk.content.length) + ' chars\n');
    }
  }
});

server.start();
