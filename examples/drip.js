include('ringo/scheduler');
include('evented/http');

var server = new HttpServer({ port: 4321 });

server.listen({
  connect: function (conn) {
    print('connected from', conn.remoteAddress.hostname);
    conn.start(200, {
      'content-type': 'text/plain'
    });
  },
  request: function (conn) {
    var times = 0;
    (function drip() {
      times++;
      setTimeout(function () {
        var promise = conn.write('drop\n');
        if (times == 10) promise.thenClose();
        else promise.then(drip);
      }, 1000);
    }());
  },
  disconnect: function () {
    print('disconnected');
  }
});

server.start();
