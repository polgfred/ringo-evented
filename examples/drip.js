include('ringo/scheduler');
include('evented/http');

var server = new HttpServer({ port: 4321 });

server.listen({
  request: function (conn) {
    conn.write({
      status: 200,
      headers: { 'content-type': 'text/plain' },
      chunked: true
    });

    var times = 0;

    (function drip() {
      times++;
      setTimeout(function () {
        var promise = conn.write({ content: 'drop\n' });
        if (times == 10) promise.thenClose();
        else promise.then(drip);
      }, 1000);
    }());
  }
});

server.start();
