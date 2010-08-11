include('evented/https');

var server = new HttpsServer({ port: 4321 });

server.listen('data', function (conn) {
  conn.start(200);
  conn.write('A ringo says what?\n').thenClose();
});

server.start();
