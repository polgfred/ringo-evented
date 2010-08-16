include('evented/http');

var server = new HttpServer({ port: 4321 });

server.listen({
  request: function (conn, request) {
    conn.write({
      status: 200,
      headers: { 'content-type': 'text/plain' },
      content: 'A ringo says what?\n'
    }).thenClose();
  }
});

server.start();
