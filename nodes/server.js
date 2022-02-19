module.exports = function(RED) {
    const path = require("path");
    const fs = require("fs");
    const WebSocket = require("ws");
    const htmlParse = require("node-html-parser").parse;
    const util = require("../util.js");
    var rootFolder = path.join(__dirname, "..");
    var webFolder = path.join(rootFolder, "web");
    var dashboards = {};
    var widgets = {};

    function server(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        var weatherLat = config.weatherLat || "";
        var weatherLong = config.weatherLong || "";
        var weatherUnit = config.weatherUnit || "";
        var weatherAppId = config.apiKey || "";
        var weatherInterval;

        dashboards = {};
        widgets = {};

        RED.log.info("-------- Dashbored Let's Start! --------");
        RED.log.info(`Root Folder: ${rootFolder}`);
        RED.log.info(`Web Folder: ${webFolder}`);
        RED.log.info(`Weather Location -> Latitude: ${weatherLat}, Longitude: ${weatherLong}`);
        RED.log.info(`Weather Unit: ${weatherUnit}`);

        //Setup the web socket server
        const wss = new WebSocket.WebSocketServer({ port: 4235 });
        wss.on("connection", (ws, request, client) => {
            RED.log.debug("Got new websocket connection");
            ws.on("message", (data) => {
                RED.log.debug(`Got websocket message [${data}]`);

                //Send the message to the dashboards
                for (var i in dashboards) {
                    dashboards[i].onMessage(JSON.parse(data));
                }
                for (var i in widgets) {
                    widgets[i].onMessage(JSON.parse(data));
                }
            });
        });

        //Send a message to all websocket client(s)
        var broadcastMessage = (data) => {
            wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.WebSocket.OPEN) {
                    client.send(data);
                }
            });
        }

        //Setup the weather if set
        var getWeather = () => {
            if (weatherLat != "" && weatherLong != "" && weatherUnit != "" && weatherAppId != "") {
                try {
                    RED.log.info("Attempt to get weather information");
                    var weather = require("openweathermap");
                    weather.now({ lat: weatherLat, lon: weatherLong, units: weatherUnit, appid: weatherAppId }, (error, out) => {
                        if (error || out.cod != 200) {
                            RED.log.error("Failed to get weather information");
                            return;
                        }

                        //Broadcast to all sessions
                        broadcastMessage(JSON.stringify({
                            id: "weather",
                            temp: out.main.temp,
                            iconUrl: out.weather[0].iconUrl
                        }));
                    });
                } catch (e) {}
            }
        }

        //Get weather updates every couple minutes
        weatherInterval = setInterval(getWeather, 500000);

        //Add a set of pages to a dashbored
        var addPagesToDashbored = (toAdd, nav, pages, onloadScript) => {
            var widgetIdsCSSDone = {};
            var firstPage = true;
            for (var i = 0; i < toAdd.length; i++) {
                var page = toAdd[i];
                var name = page.getAttribute("name") || "";
                var icon = page.getAttribute("icon") || "";
                var navigationVisibility = page.getAttribute("navigation-visibility") || "yes";
                var lockedAccess = page.getAttribute("locked-access") || "no";
                var url = page.getAttribute("url") || "";
                var id = "page_" + util.randString();
                page.setAttribute("id", id);

                //Add page to navigation
                if (navigationVisibility != "no") {
                    nav.innerHTML += `<button id="trigger_${id}">${icon != "" ? "<i class='fa " + icon + "'></i> " : ""}<p class="mobile-hidden">${name}</p></button>`;
                    //When the button is clicked make this page visible and all others not
                    onloadScript(`
                        addOnLoadFunction(function() {
                            var others =  document.getElementsByTagName("page");
                            function hideAllPages() {
                                    for(var i = 0; i < others.length; i++) {
                                    others[i].style.display = "none";
                                }
                            }

                            //Change the page
                            document.getElementById("trigger_${id}").onclick = function() {
                                hideAllPages();
                                document.getElementById("${id}").style.display = "block";
                            }

                            //Set the first page to visible
                            if(${firstPage}){hideAllPages(); document.getElementById("${id}").style.display = "block";}
                        });
                    `);
                }


                // onloadScript += `
                //     addOnMsgFunction(function(msg) {
                //         if(msg.id == "weather") {
                //             document.getElementById("weatherTemp").innerHTML = Math.round(msg.temp) + "°";
                //             document.getElementById("weatherImg").setAttribute("src", msg.iconUrl);
                //         }
                //     });
                // `;


                //GO TO ANOTHER FUNCTION TO DO THE WIDGET GENERATION
                //
                //
                //

                //Add our page
                pages.innerHTML += page.outerHTML;
                firstPage = false;
            }
        }

        ////////////////////

        //Send a message to all dashboreds
        node.sendMsg = (msg) => {
            broadcastMessage(JSON.stringify(msg));
        }

        //Return the widgets
        node.getWidgets = () => {
            return widgets;
        }

        //Return the dashboreds
        node.getDashboreds = () => {
            return dashboards;
        }

        node.addDashbored = (dashbored) => {
            RED.log.info(`- Created Dashbored [${dashbored.name}] at /${dashbored.endpoint}`);

            //Handle the incoming HTTP request
            dashbored.handleHTTP = (req, res) => {
                if (req.method != "GET") {
                    res.type("text/plain");
                    res.status(500);
                    res.send("500 - Internal Server Error");
                    return;
                }

                //Generate the HTML if requesting index
                var file = req.url.split(`/${dashbored.endpoint}/`)[1];
                if (!file || file == "index.html") {
                    fs.readFile(path.join(webFolder, "index.html"), "utf-8", (error, data) => {
                        if (error) {
                            RED.log.error("Failed to load HTML: " + error);
                            res.type("text/plain");
                            res.status(500);
                            res.send("Internal Server Error");
                        }

                        var html = htmlParse(data);
                        var head = html.querySelector("head");
                        var pages = html.querySelector("#pages");
                        var header = html.querySelector("#header");
                        var nav = html.querySelector("#nav");
                        var onloadScript = `<script id="onloadScripts" type="text/javascript">`;

                        //Set the CSS from the dashbored
                        head.innerHTML += `<style>${dashbored.CSS}</style>`;

                        //Set the header
                        header.innerHTML += `
                            ${dashbored.headerText ? "" : "<h1>" + dashbored.headerText + "</h1>"}
                            ${dashbored.headerImage ? "<img src='" + dashbored.headerImage + "' alt='dashbored logo'>" : ""}
                        `;
                        html.querySelector("#clockWeather").innerHTML = `
                            ${dashbored.showClock ? "<h2 id='clock'>" + util.formatAMPM(new Date) + "</h2>" : ""}
                            ${dashbored.showWeather ? "<div id='weather'><img id='weatherImg'></img><h2 id='weatherTemp'></h2></div>" : ""}
                        `;

                        //Set the listener for the clock updates
                        if (dashbored.showClock) {
                            onloadScript += `
                                addOnLoadFunction(function(msg) {
                                    setInterval(function() {
                                        document.getElementById("clock").innerHTML = formatAMPM(new Date());
                                    }, 1000);
                                });
                            `;
                        }

                        //Set the listener for the weather updates
                        if (dashbored.showWeather) {
                            onloadScript += `
                                addOnMsgFunction(function(msg) {
                                    if(msg.id == "weather") {
                                        document.getElementById("weatherTemp").innerHTML = Math.round(msg.temp) + "°";
                                        document.getElementById("weatherImg").setAttribute("src", msg.iconUrl);
                                    }
                                });
                            `;
                        }

                        //Set the nav bar position
                        switch (dashbored.navMode) {
                            case "bottom":
                                { break; }
                            case "top":
                                {
                                    header.classList.add("navTop");
                                    pagesDiv.classList.add("navTop");
                                    nav.classList.add("top");
                                    break;
                                }
                            case "left":
                                {
                                    header.classList.add("navSide");
                                    pagesDiv.classList.add("navSide");
                                    nav.classList.add("left");
                                    break;
                                }
                        }

                        var currDashbored = htmlParse(dashbored.HTML);
                        addPagesToDashbored(currDashbored.querySelectorAll("page"), nav, pages, (script) => {
                            onloadScript += script;
                        });

                        //For each page generate
                        // var widgetIdsCSSDone = {};
                        // var dashboredHTML = htmlParse(dashbored.HTML);
                        // var dashboredPages = dashboredHTML.querySelectorAll("page");
                        // for (var i = 0; i < dashboredPages.length; i++) {
                        // var page = dashboredPages[i];
                        // addPagesToDashbored(pages, nav, page);




                        // if (!page.getAttribute("name")) { page.setAttribute("name", "Page"); }
                        // page.setAttribute("id", "page_" + util.randString());
                        // var name = page.getAttribute("name");
                        // var id = page.getAttribute("id");







                        // //Set the page scripts
                        // onloadScript += `
                        //     addOnLoadFunction(function() {
                        //         print("debug", "onload triggered for page - ${name} (${id})");
                        //     });
                        // `;

                        // //Handle the widgets
                        // var elements = page.querySelectorAll("*");
                        // for (var j = 0; j < elements.length; j++) {
                        //     if (elements[j].rawTagName == "widget") {
                        //         var randomId = util.randString();

                        //         //Handle the widget creation
                        //         var widget = widgets[elements[j].id];
                        //         if (!widget) {
                        //             RED.log.warn(`Widget ${elements[j].id} was not found for dashbored ${dashbored.name}`);
                        //             elements[j].innerHTML = `<p style="background-color: red">Failed to generate widget</p>`;
                        //             break;
                        //         }

                        //         //Insert the onload script
                        //         onloadScript += `
                        //             addOnLoadFunction(function() {
                        //                 print("debug", "onload triggered for widget - ${widget.name} (${widget.id})");
                        //                 ${widget.generateOnload(randomId)}
                        //             });

                        //             addOnMsgFunction(function(msg) {
                        //                 //Check if the id is equal to this widget, if so execute the actions
                        //                 if(msg.id == "${widget.id}") {
                        //                     print("debug", "onmsg triggered - ${widget.name} (${widget.id})");
                        //                     ${widget.generateOnMsg(randomId)}
                        //                 }
                        //             })
                        //         `;

                        //         //Add any extra scripts/css for the widget
                        //         if (widget.generateCSS && !widgetIdsCSSDone[widget.id]) {
                        //             html.querySelector("head").innerHTML += `<style id="${widget.id}">${widget.generateCSS()}</style>`;
                        //             widgetIdsCSSDone[widget.id] = {};
                        //         }
                        //         if (widget.generateScript) { html.querySelector("html").innerHTML += `<script id="${widget.id}" type="text/javascript">${widget.generateScript(randomId)}</script>`; }

                        //         elements[j].innerHTML = widget.generateHTML(randomId);
                        //     }
                        // }
                        // pagesDiv.innerHTML = dashboredHTML.outerHTML;
                        //}

                        //Add the onload scripts and delete the element
                        onloadScript += `
                            addOnLoadFunction(function() {
                                hideShowElement("loader", false);
                            });
                        `;
                        html.querySelector("head").innerHTML += `${onloadScript}var temp = document.getElementById("onloadScripts"); temp.parentNode.removeChild(temp);</script>`;
                        res.send(html.innerHTML);

                        //And then get the weather information to send to the client via the websocket
                        getWeather();
                    });
                } else {
                    //If not index send the file if it exists
                    res.sendFile(file, { root: webFolder });
                }
            }

            //Add the dashbored
            dashboards[dashbored.id] = dashbored;
        }

        node.addWidget = (widget) => {
            RED.log.info(`- Added widget ${widget.name} (${widget.id})`);
            widgets[widget.id] = widget;
        }

        //On redeploy
        node.on("close", () => {
            wss.close();
            clearInterval(weatherInterval);
        });
    }

    //Setup the HTTP server
    RED.httpNode.get(`/script.js`, (req, res) => { res.sendFile("script.js", { root: webFolder }); });
    RED.httpNode.get(`/style.css`, (req, res) => { res.sendFile("style.css", { root: webFolder }); });
    //Send the widget ids for the node red editor to populate (if theres a better way i'd like to know...)
    RED.httpNode.get(`/dashboredgetallnodeids`, (req, res) => {
        var send = [];
        for (var i in widgets) { send.push(`{"value":"${i}", "label":"${widgets[i].name}"}`); }
        res.send(send);
    })
    RED.httpNode.get("/*", (req, res) => {
        for (var i in dashboards) {
            if ("/" + dashboards[i].endpoint == req.url) {
                RED.log.debug("Got request for dashbored " + dashboards[i].name);
                dashboards[i].handleHTTP(req, res);
                break;
            }
        }
    });

    RED.nodes.registerType("dashbored-server", server);
}