## ringo-evented: An evented library for RingoJS based on the Java Netty project

The goal of `ringo-evented` is to make it really easy to write event-based client and server applications in JavaScript that make full use of both the [CommonJS](http://commonjs.org/) and [Java](http://java.oracle.com/) ecosystems. It is built on top of the excellent [Netty](http://jboss.org/netty/) project, which provides both a solid NIO client/server Java framework and an impressive array of codecs for dealing with network protocols.

_At this time `ringo-evented` is in an extremely pre-alpha state, and the APIs should be considered highly unstable. My purpose right now is to create some excitement and interest around the idea, and to show what a good JavaScript Netty wrapper might look like. Feedback is welcome -- nay, encouraged!_

## Getting Started

`ringo-evented` is bundled as a CommonJS package targeting the [RingoJS](http://ringojs.org/) platform (though I'm keeping it CommonJS compliant in order to work with other Rhino-based engines, e.g. Narwhal, as well). You can install it globally into your `ringojs/packages` directory, or as a dependency of another package or Ringo webapp.

Currently, basic socket server, HTTP server, and HTTP connection objects are supported. Let's look at a couple examples.

## Examples

I'll quote `examples/stupid.js` in its entirety because it's so short:

    include('evented/http');
    
    var server = new HttpServer({ port: 4321 });
    
    server.listen('request', function (conn) {
      conn.start(200);
      conn.write('A ringo says what?\n').thenClose();
    });
    
    server.start();

This is a fully functioning web app that does pretty much exactly what it looks like it does.

Things to note:

* Rather than blocking in a loop and waiting for incoming connections, you simply ask the server to register you for the events that you care about. Mostly you'll care about the 'request' and 'chunk' events. (You can also register for 'open', 'bind', 'connect', 'disconnect', 'unbind', 'close', and 'error'.)
* It's not just that incoming IO is non-blocking; outgoing IO is as well. If we did `conn.write(...)` followed by `conn.close()` we'd have no guarantee that the write actually completed before the socket closed. To make non-blocking writes easier to work with, the `HttpConnection#write` method returns a special object called a "promise," which supports the chaining together of asynchronous operations. As a convenience, write-promises support a `.thenClose()` operation which promises to close the connection after the write completes.

As an exercise, you can also check out `examples/drip.js` to see an application that writes "drop" to the client once per second, for ten seconds, and then closes the connection.

## Inspirations

* [NodeJS](http://nodejs.org/) -- Evented IO for V8 JavaScript [TODO]
* [Aleph](http://github.com/ztellman/aleph) -- Asynchronous web server in Clojure, also built on Netty [TODO]
