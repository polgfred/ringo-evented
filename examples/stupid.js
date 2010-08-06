include('evented/http');

var server = new HttpServer({ port: 4321 });

server.listen('data', function (conn) {
  conn.write('A ringo says what?\n').thenClose();
});

server.start();
