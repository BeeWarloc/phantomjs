console.log('Hello, world!');

var httpServer = phantom.createHttpServer();

httpServer.newRequest2.connect(function (request, response) {
    console.log(JSON.stringify(request));
    response.setHeader("Content-Length", "11");
    response.writeHead(200);
    response.write("Hello World!");
    response.end();
});

httpServer.listen(8080);

//phantom.exit();

