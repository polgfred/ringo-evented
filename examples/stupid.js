include('evented');
include('evented/http');

var server = new HttpServer({ port: 4321 });

server.listen({
  connect: function (conn) {
    print('connection from', conn.remoteAddr);
    conn.start(200, {
      'content-type': 'text/plain'
    });
  },
  data: function (conn, data) {
    print(data);
    conn.write('i got this\n');
    conn.write('more1\n');
    conn.write('more2\n');
    conn.write('more3\n');
    conn.write('more4\n').thenClose();
  },
  close: function () {
    print('closed');
  }
});

server.start();
