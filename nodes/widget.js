/**
 * Toggle button
 * 
 * Will toggle between two states
 * 
 * onValue = The value when the switch is "on"
 * offValue = The value when the switch is "off"
 * 
 * Input/output is a payload of the on/off value.
 * {
 *  "payload": true
 * }
 * 
 * https://github.com/haydendonald/NodeRed-Dashbored
 * 
 */

module.exports = function (RED) {

    function widget(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        const util = require("../util.js");

        var name = config.name || "Toggle Button";
        var server = RED.nodes.getNode(config.server);
        var text = config.text || "Toggle Button";
        var onValue = config.onValue || "on";
        var offValue = config.offValue || "off";
        var CSS = config.CSS || "";
        var currentState = offValue;
        var nodeMsgFunctions = [];
        var id = node.id;

        //When a message is received from the dashbored
        node.onMessage = (msg) => {
            if (msg.id == id) {
                for (var i = 0; i < nodeMsgFunctions.length; i++) {
                    nodeMsgFunctions[i](msg.payload);
                    currentState = msg.payload;
                }
            }
        }

        //Generate the CSS for the widget to be inserted into the dashbored
        node.generateCSS = () => {
            //Go through the CSS and add the ids
            var rebuild = "";
            var classes = CSS.split("}");
            for (var i = 0; i < classes.length - 1; i++) {
                var selectors = classes[i].split(" {");
                selectors[0] = selectors[0].replace(/^\s+|\s+$/gm, '');
                var output = `${selectors[0][0]}n${id.split(".")[0]}_${selectors[0].substring(1)} {${selectors[1]}}\n`;
                rebuild += output;
            }

            return rebuild;
        }

        //Generate the HTML for the widget to be inserted into the dashbored
        node.generateHTML = (id) => {
            return `
            ${util.generateTag(id, "button", "button", text, `class="${util.generateCSSClass(node, "button")} ${util.generateCSSClass(node, (currentState == offValue ? "off" : "on"))}" state="${currentState}"`)}
            `;
        }

        //Generate the script to be executed in the dashbored when the page loads
        node.generateOnload = (htmlId, lockedAccess, alwaysPassword, ask, askText) => {
            return `
            ${util.getElement(htmlId, "button")}.onclick = function(event) {
                var yesAction = function() {
                    sendMsg("${id}", event.target.getAttribute("state") == "${onValue}" ? "${offValue}" : "${onValue}");
                }
                var noAction = function(){console.log("no");}

                ${util.generateWidgetAction(lockedAccess, alwaysPassword, ask, askText, "yesAction", "noAction")}
            } 
            
            //Hide the element initially if required
            if(locked) {
                ${lockedAccess == "no" ? "hideShowElement('" + htmlId + "', false);" : ""}
            }
            `;
        }

        //Generate the script to be executed in the dashboard when a msg comes in to the widget
        //msg can be used to get the msg object
        node.generateOnMsg = (htmlId) => {
            return `
            ${util.getElement(htmlId, "button")}.setAttribute("state", msg.payload);
            if(msg.payload == "${onValue}") {
                ${util.getElement(htmlId, "button")}.classList.add("${util.generateCSSClass(node, "on")}");
                ${util.getElement(htmlId, "button")}.classList.remove("${util.generateCSSClass(node, "off")}");
            }
            else {
                ${util.getElement(htmlId, "button")}.classList.add("${util.generateCSSClass(node, "off")}");
                ${util.getElement(htmlId, "button")}.classList.remove("${util.generateCSSClass(node, "on")}");
            }
            `;
        }

        //Generate any extra scripts to add to the document for the widget
        node.generateScript;

        //Add this widget to the server
        server.addWidget(id, name);

        //When an input is passed to the node in the flow
        node.input = (msg) => {
            if (msg.payload) {
                currentState = msg.payload;
                server.sendMsg(id, currentState);
            }
        }

        //Functions to be called when a msg comes from the dashbored
        //fn(msg)
        node.addNodeMsgFunction = (fn) => {
            nodeMsgFunctions.push(fn);
        }

        //On redeploy
        node.on("close", () => { });
    }

    RED.nodes.registerType("dashbored-widget", widget);
}