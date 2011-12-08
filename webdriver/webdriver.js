
var dump = function(o) { console.log(JSON.stringify(o, null, 4)); };

// Test

var RequestRouter = function(target)
{
    this.checkRouteMatch = function(route, successHandler, req, res) {
        var path = req.path;
        var routeParts = route.split("/");
        var pathParts = path.split("/");
        var result = true;
        var pathVars = {};

        var doGreedySearch =
            routeParts.length > 0 &&
            routeParts[routeParts.length - 1] == "*" &&
            pathParts.length >= routeParts.length;

        if (routeParts.length == pathParts.length || doGreedySearch) {

            while (routeParts.length > 0) {
                var rp = routeParts.shift();
                var pp = pathParts.shift();

                if (rp == "*" && routeParts.length == 0) {
                    // Wildcard success!
                    req.pathRemaining = pp;
                    while (pathParts.length > 0) {
                        req.pathRemaining += "/" + pathParts.shift();
                    };
                    break;
                }
                else if (rp.length > 1 && rp.charAt(0) == ':') {
                    // fetch variable name
                    var varname = rp.substr(1);
                    if (varname.length > 0) {
                        pathVars[varname] = pp;
                    }
                }
                else {
                    // compare and break if not equal
                    if (rp != pp) {
                        result = false;
                        break;
                    }
                }
            }
        }
        else {
            result = false;
        }

        if (result) {
            req.pathVars = pathVars;

            // If result of handler is false, it don't match
            console.log("Calling handler for path " + path + " matched by route " + route);
            result = successHandler.call(this.target, req, res);
        }

        return result;
    };

    this.target = target;
};

RequestRouter.prototype.dispatch = function(req, res) {
    // Find first matching method
};

var WebDriverRemote = function()
{
    this.router = new RequestRouter(this);

    this.sessionIdCounter = 1;
    this.generateSessionId = function() { return "S" + this.sessionIdCounter++; }

    this.sessions = {};
};

WebDriverRemote.prototype.dispatch = function(req, res) {
    var success = false;

    if (req.method == "GET" && (req.path == "/index.html" || req.path == "/")) {
        res.body = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Webdriver Test Page</title></head>\n' +
                '<body>\n' +
                '    <div id="div1" class="foo">Inside first div (div1)</div>\n' +
                '    <div id="div2" class="foo bar pixie">Inside second div (div2)<span id="span_inside_div2">Text of child node of div2</span></div>\n' +
                '    <span id="span_outside_div"></span>\n' +
                '    <form name="bananas_form"><input id="some_input_id" name="some_input" value="bollocks" /></form>\n' +
                '    <a id="funky_anchor">href="http://wikipedia.org">To the brain machine</a>\n' +
                '</body></html>\n';
        res.headers["Content-Type"] = "text/html;charset=UTF-8";
        success = true;
    }

    if (!success && req.method == "POST" && req.path == "/session") {
        var sessionId = this.generateSessionId();

        var session = new WebDriverSession(sessionId);
        this.sessions[sessionId] = session;

        res.headers["Location"] = "/session/" + sessionId;
        res.code = 301;// Moved permanently
        return;
    }

    if (!success && req.method == "GET") {
        var success =
            this.router.checkRouteMatch("/session/:sessionId", this.getSession, req, res);
    }

    if (!success) {
        // Match all methods
        var success =
            this.router.checkRouteMatch("/session/:sessionId/*", this.forwardRequestToSession, req, res);
    }

    if (!success) {
        res.code = 501;
        res.body = "No route match.. soryy :(";
    }
};

WebDriverRemote.prototype.getSession = function(req, res) {
    res.bodyData = {
        sessionId : req.pathVars.sessionId,
        "status" : 0,
        value : {
            browserName : "phantom",
            version : "1.3.0",
            platform : "LINUX"
        }
    };
    return true;
};

WebDriverRemote.prototype.forwardRequestToSession = function(req, res) {
    var sessionId = req.pathVars.sessionId;

    if (this.sessions === undefined)
        throw "this.sessions is undefined, do you have the right this?";
    
    var session = this.sessions[sessionId];
    var success = true;

    if (session !== undefined) {
        // Session found!
        success = session.dispatch(req, res);
    }
    else {
        // Session not found..
        res.code = 404;
        res.body = "Session with id " + sessionId + " not found";
    }

    return success;
};


var WebDriverSession = function(sessionId) {
    this.sessionId = sessionId;
    this.page = new WebPage();
    this.page.onConsoleMessage = function(msg) { console.log("Session " + sessionId + " message: " + msg); };

    this.router = new RequestRouter(this);

    this.evalState = {
        idCounter : 1
    };

    this.throwMissingCommandParameter = function(missingParamsArray) {
        throw "TODO_NotImplementedException";
    };
};


var sandboxFunctions = function() {

    this.generateUuid = function c(a,b){return a?(b|Math.random()*16>>b/4).toString(16):([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/1|0|(8)/g,c)};
    //var generateUuid = function() { return "E" + Math.random(); };

    this.getElementByUuid = function(uuid) {
        if (document.__webdriverIdMap !== undefined)
            return document.__webdriverIdMap[uuid];
    };

    this.getUuidForElement = function(element) {
        if (element.__webdriverId === undefined) {
            element.__webdriverId = this.generateUuid();
            if (document.__webdriverIdMap === undefined)
                document.__webdriverIdMap = {};
            document.__webdriverIdMap[element.__webdriverId] = element;
        }
        return element.__webdriverId;
    };

    // this.locateElement = function(req, res)

    this.simulateClick = function(elm) {
        // TODO: This don't actually seem to work, at least not with native events
        var evt = document.createEvent("MouseEvents");
            evt.initMouseEvent("click", true, true, window,
                0, 0, 0, 0, 0, false, false, false, false, 0, null);
            var canceled = !elm.dispatchEvent(evt);
        if(canceled) {
                        // A handler called preventDefault
                            // uh-oh, did some XSS hack your site?
        } else {
                                      // None of the handlers called preventDefault
                                          // do stuff
        }
    }


    this.searchForElements = function(strategy, query, findFirst, startFrom) {
        if (startFrom) {
            throw "Searching for element with startFrom set not implemented";
        }
        var elements = [];
        var e = null;
        var i = 0;
        var xpathQuery = null;

        switch (strategy) {
            case "name":
                elements = document.getElementsByName(query);
                break;
            case "id":
                // Only one id at a page allowed, so just support this
                e = document.getElementById(query);
                if (e) elements.push(e);
                break;
            case "tag name":
                elements = document.getElementsByTagName(query);
                break;
            case "partial link text":
                if (!xpathQuery) xpathQuery = "//a[contains(text(),'" + query + "')]";
            case "link text":
                // TODO: Find out how to do correct escaping here
                if (!xpathQuery) xpathQuery = "//a[text()='" + query + "']";
                // Indented fallthrough to xpath
            case "xpath":
                if (!xpathQuery) xpathQuery = query;

                console.log("searching with xpath expression \"" + xpathQuery + "\"");
                var iterator = document.evaluate(xpathQuery, document, null, "ORDERED_NODE_ITERATOR_TYPE", null);
                var node = iterator.iterateNext();
                while (node) {
                    elements.push(node);
                    node = iterator.iterateNext();
                }
                break;
            case "css selector":
                if (findFirst) {
                    e = document.querySelector(query);
                    if (e) {
                        elements.push(e);
                    }
                }
                else {
                    // Use querySelectorAll
                    elements = document.querySelectorAll(query);
                }
                break;
            default:
                throw "TODO: Error handling. Strategy not implemented, sorry";
        }

        if (elements) {
            var elementIds = [];
            // elements might not be an array, but a NodeList instead.
            // Still, both types got length and [index] accessor
            for (i = 0; i < elements.length; i++) {
                elementIds.push(this.getUuidForElement(elements[i]));
            }
            return elementIds;
        }
        
        throw "Todo: error handling";
    };

    this.postToElement = function(req, res) {
        var element = this.getElementByUuid(req.pathVars.id);
        if (element) {
            // Now check what command
            var pathParts = req.pathRemaining.split("/");

            res.code = 200;

            switch (pathParts.length > 0 ? pathParts.shift() : null) {
                case "clear":
                    element.setAttribute("value", "");
                    res.bodyData.status = 0;
                    break;
                case "click":
                    this.simulateClick(element);
                    res.bodyData.status = 0;
                    break;
                default:
                    res.code = 404;
                    res.bodyData = null;
                    res.body = "Element found but POST command " + req.pathRemaining + " not recognized";
                    break;
            }
        }
        else {
            // Element with id not found..
            res.code = 404;
            res.bodyData = null; // Set bodyData to null, if not body will be overwritten
            res.body = "Element with id " + req.pathVars.id + " not found";
        }
        return true;
    };

    this.getElementInfo = function(req, res) {
        var element = this.getElementByUuid(req.pathVars.id);
        if (element) {
            // Now check what command
            var pathParts = req.pathRemaining.split("/");

            res.code = 200;

            switch (pathParts.length > 0 ? pathParts.shift() : null) {
                case "attribute":
                    var attrName = pathParts.shift();
                    res.bodyData.value = element.getAttribute(attrName);
                    res.bodyData.status = 0;
                    break;
                case "name":
                    res.bodyData.value = element.tagName;
                    res.bodyData.status = 0;
                    break;
                default:
                    res.code = 404;
                    res.bodyData = null;
                    res.body = "Element found but command " + req.pathRemaining + " not recognized";
                    break;
            }
        }
        else {
            // Element with id not found..
            res.code = 404;
            res.bodyData = null; // Set bodyData to null, if not body will be overwritten
            res.body = "Element with id " + req.pathVars.id + " not found";
        }
        return true;
    };

    this.fillResponseForElement = function(element, res) {
        if (element) {
            // Success
            res.bodyData.value = { ELEMENT : this.getUuidForElement(element) };
            res.bodyData.status = 0;
        } else {
            // NoSuchElement - An element could not be located on the page using the given search parameters.
            res.bodyData.status = 7;
        }
        return true;
    }

    this.getElementById = function(req, res) {
        return this.fillResponseForElement(document.getElementById(req.bodyData.value), res);
    }
}

WebDriverSession.prototype.generateWrapperFunction = function(funcWithNoArg) {
    var i;
    var args = {};
    // The reason for serializing to a dictionary and not an array is
    // that undefined objects in arrays will become null. Which is.. wrong.
    for (i = 1; i < arguments.length; i++) {
        args["a" + (i - 1)] = arguments[i];
    }

    var argCallArguments = "";

    var i = 0;
    for (i = 0; i < (arguments.length - 1); i++)
    {
        if (argCallArguments.length > 0)
            argCallArguments += ", ";

        argCallArguments += "args.a" + i + "";
    }

    code = "function () {\n";
    code += "console.log('Defining new self prototype with lib:');\n";
    code += "var self = new (" + sandboxFunctions.toString() + ")();\n";
    code += "console.log('Defining funcToCall:');";
    code += "var funcToCall = " + funcWithNoArg.toString() + "\n\n";
    code += "console.log('Defining args:');";
    code += "var args = " + JSON.stringify(args, null, 4);
    code += ";\n\n";
    code += "console.log('Calling funcToCall:');";
    code += "args.r = funcToCall.call(self, " + argCallArguments + ");\n";
    code += "console.log('Returning args');";
    code += "return args;\n";
    
    code += "}";

    console.log("Wrapped call:");
    console.log(code);

    // return this.page.evaluate(wrappedFunction);
    console.log("Bai!");
    return code;
};

WebDriverSession.prototype.wrapHttpCall = function(funcToCall, req, res) {
    // Fill out response status, predefine an error code
    console.log("res : " + res);
    res.code = 200;
    res.bodyData = { sessionId : this.sessionId, "status" : 13 };
    var wfunc = this.generateWrapperFunction(funcToCall, req, res);
    console.log("Start evaluation of wrapped function.");
    var ret = this.page.evaluate(wfunc);
    console.log("Evaluated.");
    dump(ret);

    // HACK: need to replace with data from returned request
    var sourceRes = ret.a1; // res is argument number 1 counting from 0
    res.code = sourceRes.code;
    res.bodyData = sourceRes.bodyData;

    console.log("done with wrapHttpCall");

    return ret.r;
};

console.log("Testing wrapping of function:");
console.log(WebDriverSession.prototype.generateWrapperFunction(function (req, res) { res.code = 202; }, { method : "GET" }, { blah : "nah" }));

WebDriverSession.prototype.dispatch = function(req, res) {
    var success = false;

    console.log("Inside session dispatch with url " + req.path);
    if (!success && req.method == "POST") {
        success =
            this.router.checkRouteMatch("/session/:sessionId/url", this.postUrl, req, res) ||
            this.router.checkRouteMatch("/session/:sessionId/element", this.postElement, req, res) ||
            this.router.checkRouteMatch("/session/:sessionId/element/:id/*", this.postToElement, req, res);

        console.log("Route match success: " + success);

        if (success && res.body == undefined && res.bodyData == undefined && res.code == 200) {
            // put in success reply by default
            res.bodyData = { sessionId : this.sessionId, "status" : 0 };
        }
    }

    if (!success && req.method == "GET") {
        success = this.router.checkRouteMatch("/session/:sessionId/element/:id/*", this.getElementInfo, req, res);
    }

    console.log("Done with session dispatch");

    return success;
}

WebDriverSession.prototype.getElementInfo = function(req, res) {
    return this.wrapHttpCall(function(req, res) { return this.getElementInfo(req, res); }, req, res);
}

WebDriverSession.prototype.postToElement = function(req, res) {
    return this.wrapHttpCall(function(req, res) { return this.postToElement(req, res); }, req, res);
}

WebDriverSession.prototype.checkDataParameters = function(req, res) {
    console.log("TODO: implement checking of json parameters for request in checkDataParameters");
    // No error checking for now..
    return true;
}

WebDriverSession.prototype.postUrl = function(req, res) {
    var data = req.bodyData;
    if (!this.checkDataParameters(req, res, ["url"])) return true;

    this.page.open(data.url, function() { console.log("Url " + data.url + " opened!"); });
    return true;
}


WebDriverSession.prototype.postElement = function(req, res) {
    var data = req.bodyData;
    if (!this.checkDataParameters(req, res, ["using", "value"])) return true;

    // TODO: Proper error handling here for unsupported usings

    console.log("Start run code in sandbox");
    var wfunc = this.generateWrapperFunction(
        function (strategy, query, findFirst, startFrom) {
            return this.searchForElements(strategy, query, findFirst, startFrom);
        }, data.using, data.value, 1, false);

    console.log("Start evaluation of wrapped function.");
    var ret = this.page.evaluate(wfunc);
    console.log("Evaluated.");
    dump(ret);

    var elements = ret.r;

    if (elements) {
        if (elements.length > 0) {
            res.bodyData = {};
            res.bodyData.sessionId = this.sessionId;
            res.bodyData.value = { ELEMENT : elements[0] };
            res.bodyData.status = 0;
        }
        else {
            res.bodyData.status = 7;
        }
    }
    else {
        throw "Error handling not implemented";
    }

    console.log("Stop run code in sandbox");

    // return NoSuchElement for now..

    return true;
}

WebDriverSession.prototype.getElementAttribute = function(req, res) {
    this.wrapHttpCall(function (req, res) { this.getElementAttribute(req, res); }, req, res);
    return true;
}

WebDriverSession.prototype["POST"] = {};
WebDriverSession.prototype["GET"] = {};

WebDriverSession.prototype["POST"]["/timeouts/async_script"] = function(data) {
    if (data.ms !== undefined || IsNaN(data.ms))
        this.throwMissingCommandParameter(["ms"]);

    this.asyncScriptTimeout = data.ms;
};

WebDriverSession.prototype["POST"]["/timeouts/implicit_wait"] = function(data) {
    if (data.ms !== undefined || IsNaN(data.ms))
        this.throwMissingCommandParameter(["ms"]);

    // TODO: check timeout is >= 0

    this.implicitWaitTimeout = data.ms;
};

WebDriverSession.prototype["GET"]["/window_handle"] = function() {
    return this.currentWindowHandle;
};

WebDriverSession.prototype["GET"]["/window_handles"] = function() {
    // TODO: Support more than one window handle in one session..
    return [ this.currentWindowHandle ];
};

WebDriverSession.prototype["GET/url"] = function() {
    // TODO: Don't know how to get current url from phantom
    throw "TODONotImplemented";
};

WebDriverSession.prototype["POST"]["/url"] = function(data) {
    if (data.url !== undefined)
        this.throwMissingCommandParameter(["url"]);
    this.page.open(data.url);
};

WebDriverSession.prototype["POST"]["/forward"] = function() {
    throw "TODONotImplemented";
};

WebDriverSession.prototype["POST"]["/back"] = function() {
    throw "TODONotImplemented";
};

WebDriverSession.prototype["POST"]["/refresh"] = function() {
    throw "TODONotImplemented";
};

WebDriverSession.prototype["POST"]["/elements"] = function(data) {
};

function lengthInUtf8Bytes(str) {
      // Matches only the 10.. bytes that are non-initial characters in a multi-byte sequence.
        var m = encodeURIComponent(str).match(/%[89ABab]/g);
          return str.length + (m ? m.length : 0);
}

var webDriverServer = new WebDriverRemote();

var httpServer = phantom.createHttpServer();

httpServer.newRequest2.connect(function (request, response) {
    var preq = { body: "" };

    request.dataEncoded.connect(function (data) {
        preq.body += data;
        console.log("New incoming data " + data);
    });

    request.end.connect(function (data) {
        console.log("Incoming data end");

        // Setup packed request
        preq.method = request.method;
        preq.path = request.path;
        preq.headers = request.headers;
        preq.pathVars = {};
        
        // Support HEAD
        if (preq.method == "HEAD") {
            // This is just a way to support HEAD without implementing explicit support in handlers
            // When preq.isHeadMethod is set we just don't return a body!
            preq.method = "GET";
            preq.isHeadMethod = true;
        }

        // Setup packed response
        var pres = {
            code : 200,
            headers : {}
        };

        if (preq.body.length > 0) {
            preq.bodyData = JSON.parse(preq.body);
        };

        console.log("Dispatching request: \n" + JSON.stringify(preq, null, 4) + "\n");
        webDriverServer.dispatch(preq, pres);
        console.log("Response of request: \n" + JSON.stringify(pres, null, 4) + "\n");

        if (pres.bodyData !== undefined) {
            console.log("Converting bodyData to body");
            pres.body = JSON.stringify(pres.bodyData, undefined, 4);
            pres.headers["Content-Type"] = "application/json;charset=UTF-8";
        };

        if (pres.body !== undefined && pres.body !== null) {
            console.log("Body exists, lets calculate its length.");

            var lengthInBytes = lengthInUtf8Bytes(pres.body);
            pres.headers["Content-Length"] = "" + lengthInBytes;

            if (pres.headers["Content-Type"] === undefined) {
                pres.headers["Content-Type"] = "text/plain";
            };
        };

        console.log("Ready to write out headers:");
        for (var headerKey in pres.headers) {
            console.log("  - Setting header " + headerKey + " to " + pres.headers[headerKey]);
            response.setHeader(headerKey, pres.headers[headerKey]);
        }
        console.log("Done writing headers.");

        console.log("Writing response code " + pres.code);
        response.writeHead(pres.code);

        if ((!preq.isHeadMethod) && pres.body !== undefined && pres.body.length > 0) {
            console.log("Writing response body");
            response.write(pres.body);
        }

        console.log("Ending response");

        response.end();

        // TODO: The below lines seems to hang the javascript engine, does this create a problem with dangling signals?
        // request.dataEncoded.disconnect();
        // request.end.disconnect();
    });

    // TODO: Should probably connect to the done signal of request too.. I suspect memory leaks here!

    console.log(JSON.stringify(request, undefined, 4));
});

httpServer.listen(8080);

