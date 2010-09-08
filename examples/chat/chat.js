var fs = require('fs');

include('evented/http');

var members = (function () {
  var preamble = '.';
  for (var i = 0; i < 10; ++i)
    preamble = preamble + preamble;

  var list = {};

  return {
    put: sync(function (conn, userId) {
      list[userId] = conn;
    }),

    remove: sync(function (conn) {
      var channelId = conn.channel.id;
      for each (var userId in Object.keys(list))
        if (list[userId].channel.id == channelId)
          delete list[userId];
    }),

    deliver: sync(function (payload) {
      payload.preamble = preamble;
      for each (var userId in Object.keys(list))
        list[userId].write({ content: JSON.stringify(payload) });
    })
  };
}());

var server = new HttpServer({ port: 4321 });

server.listen({
  request: function (conn, request) {
    if (request.path == '/') {
      var chatPage = fs.read('examples/chat/chat.html');
      conn.write({ status: 200, content: chatPage }).thenClose();
    }

    else if (request.path == '/say') {
      var payload = JSON.parse(request.content);
      var userId  = payload.userId;
      var message = payload.message || '(joined the room)'
      conn.write({ status: 200, chunked: true });
      members.put(conn, userId);
      members.deliver({ userId: userId, message: message });
    }
  },

  error: function (conn) {
    members.remove(conn);
  }
});

server.start();
