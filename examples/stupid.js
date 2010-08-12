include('evented/http');

var server = new HttpServer({ port: 4321 });

server.listen('request', function (conn) {
  conn.start(200);
  conn.write('A ringo says what?\n').thenClose();
});

server.start();
