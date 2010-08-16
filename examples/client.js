include('evented/http');

var client = new HttpClient({ host: 'localhost', port: 4321 });

client.listen({
  response: function (conn, response) {
    print(response.content);
  }
});

client.request({
  method: 'GET',
  path:   '/foo',
  params: { x: 1, y: 2 }
});
