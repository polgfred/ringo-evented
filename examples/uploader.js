/*
* A slightly contrived example of how to handle chunked and non-chunked requests in the same server.
* 
* The pseudocode, in a nutshell:
*
* - In the 'request' message handler, check to see whether the 'chunked' attribute is true.
*   - If it is:
*     - The request is chunked. (No kidding.)
*     - The request has NO content, but everything else will be present (headers, params, etc.).
*     - Begin processing the request.
*     - In the 'chunk' message handler, check to see whether the 'last' attribute is true.
*       - If it is:
*         - This is the final chunk.
*         - It has NO content, but may have trailing headers. (I know, a bit of an oxymoron. Also, these
*           aren't implemented yet.)
*         - Finish processing the request and close the connection.
*       - If is it not:
*         - The chunk contains content in its 'content' attribute.
*         - Process the chunk and leave the connection open.
*   - If it is not:
*     - The request is not chunked.
*     - The request contains all the content in its 'content' attribute.
*     - Process the request and close the connection.
*/

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
