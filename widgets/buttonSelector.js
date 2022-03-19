/**
 * Button Selector Widget for Dashbored
 * Allows for selecting a value using multiple buttons
 * https://github.com/haydendonald/NodeRed-Dashbored
*/

module.exports = {
    type: "buttonSelector",
    version: "0.0.1",
    label: "Button Selector",
    description: "Generates buttons that select states",
    create: function () {
        return {
            widthMultiplier: 1,
            heightMultiplier: 1,
            minWidth: undefined,
            minWeight: undefined,
            maxWidth: undefined,
            maxHeight: undefined,
            widget: undefined, //Reference back to the widget node

            //Insert the HTML into the config on the NodeRed flow
            //The ids MUST be node-config-input-<WIDGETNAME>-<CONFIGNAME> otherwise they may not be set
            configHTML: function () {
                return `
                    <div class="form-row">       
                        <ol id="options"></ol>
                    </div>

                    <!-- CSS Editor -->
                    <div class="form-row">
                        <label for="CSS">CSS</label>
                        <div style="height: 250px; min-height:150px;" class="node-text-editor" id="CSS"></div>
                    </div>
                `;
            }(),
            //Scripts to call on the NodeRed config dashbored
            configScript: {
                //When the user opens the config panel get things ready
                oneditprepare: `
                    //Validate and add an item
                    function validate() {
                        var self = this
                        this["buttonSelector-options"] = [];
                        var optionsList = $("#options").editableList('items');
                        optionsList.each(function (i) {
                            var option = $(this);
                            var curr = {};
                            curr["label"] = option.find(".node-input-option-label").val();
                            curr["value"] = option.find(".node-input-option-value").typedInput('value');
                            curr["onColor"] = option.find(".node-input-option-onColor").val();
                            curr["offColor"] = option.find(".node-input-option-offColor").val();
                            self["buttonSelector-options"].push(curr);
                        });
                    }

                    var optionsList = $("#options").css('min-height', '200px').editableList({
                        header: $("<div>").css('padding-left', '32px').append($.parseHTML(
                            "<div style='width:35%; display: inline-grid'><b>Label</b></div>" +
                            "<div style='width:35%; display: inline-grid'><b>Value</b></div>" +
                            "<div style='width:15%; display: inline-grid' class='node-input-option-color'><b>On Colour</b></div>" +
                            "<div style='width:15%; display: inline-grid' class='node-input-option-color'><b>Off Colour</b></div>")),
        
                        addItem: function (container, i, option) {
                            var row = $('<div/>').appendTo(container);
                            var labelField = $('<input/>', { class: "node-input-option-label", type: "text" }).css({ "width": "35%", "margin-left": "5px", "margin-right": "5px" }).appendTo(row);
                            labelField.val(option.label || "Option " + i);
        
                            var valueField = $('<input/>', { class: "node-input-option-value", type: "text" }).css({ "width": "35%", "margin-left": "5px", "margin-right": "5px" }).appendTo(row);
                            valueField.typedInput({ types: ['str', 'num', 'bool'] });
                            valueField.typedInput("type", option.valueType || "str");
                            valueField.typedInput("value", option.value || "option_" + i);
                            valueField.on('change', function (type, value) {
                                validate();
                            });
        
        
                            var onColorField = $('<input/>', { class: "node-input-option-onColor", type: "color" }).css({ "width": "10%", "margin-left": "5px", "display": onColorField }).appendTo(row);
                            onColorField.val(option.onColor || "#99ff99");
        
                            var offColorField = $('<input/>', { class: "node-input-option-offColor", type: "color" }).css({ "width": "10%", "margin-left": "5px", "display": offColorField }).appendTo(row);
                            offColorField.val(option.offColor || "#ff3333");
                            validate();
        
        
                        },
                        removeItem: function (data) {
                            validate()
                        },
                        removable: true,
                        sortable: true,
        
                    });
        
                    //Add existing options
                    if (element["buttonSelector-options"]) {
                        element["buttonSelector-options"].forEach(function (option, index) {
                            optionsList.editableList('addItem', { label: option.label, value: option.value, onColor: option.onColor, offColor: option.offColor });
                        });
                    }

                    element.cssEditor = RED.editor.createEditor({
                        id: "CSS",
                        mode: "ace/mode/css",
                        value: element["toggleButton-CSS"]
                    });
                `,
                //When the user clicks save on the editor set our values
                oneditsave: `
                    var self = this;
                    var temp = [];
                    var optionsList = $("#options").editableList('items');
                    optionsList.each(function (i) {
                        var option = $(this);
                        var curr = {};
                        curr["label"] = option.find(".node-input-option-label").val();
                        curr["value"] = option.find(".node-input-option-value").typedInput('value');
                        curr["onColor"] = option.find(".node-input-option-onColor").val();
                        curr["offColor"] = option.find(".node-input-option-offColor").val();
                        temp.push(curr);
                    });

                    element["buttonSelector-options"] = temp;

                    //Set the CSS value
                    element["buttonSelector-CSS"] = element.cssEditor.getValue();

                    //Delete the CSS editor
                    element.cssEditor.destroy();
                    delete element.cssEditor;
                `,
                //When the user cancels the edit dialog do some cleanup if required
                oneditcancel: `
                    //Delete the CSS editor
                    element.cssEditor.destroy();
                    delete element.cssEditor;
                `,
                //When the user clicks the "reset configuration" set the options to their defaults
                reset: `
                    element.cssEditor.setValue(defaultConfig.CSS.value);
                    element.cssEditor.clearSelection();
                `
            },
            //Default config
            defaultConfig: {
                options: {
                    value: [
                        {
                            "label": "Option 0",
                            "value": "option_0",
                            "onColor": "#99ff99",
                            "offColor": "#ff3333"
                        }
                    ],
                    validate: function (values) {
                        if (values === undefined) { return false; }
                        for (var i in values) {
                            if (values[i].label === undefined) { return false; }
                            if (values[i].value === undefined || values[i].value == "") { return false; }
                            if (values[i].offColor === undefined || values[i].offColor == "") { return false; }
                            if (values[i].onColor === undefined || values[i].onColor == "") { return false; }
                        }
                        return true;
                    }
                },

                CSS: {
                    value: ``.replace(/^\s+|\s+$/gm, ''), required: true
                }
            },
            //Current config
            config: {},

            //Default value(s)
            getDefaultValues: function () {
                return {
                    state: this.config.options[0].value
                }
            },

            //Return the current values
            getValues: function () {
                return {
                    state: this.widget.getValue("state")
                }
            },

            //Setup the widget
            setupWidget: function (widget, config) {
                this.widget = widget;

                //Set the configuration
                this.config.options = config["buttonSelector-options"];
                this.config.CSS = config["buttonSelector-CSS"];
            },

            //When node red redeploys or closes
            onClose: function () { },

            //When a message comes from the dashbored
            onMessage: function (msg) {
                if (msg.id.split("_")[0] == this.id) {
                    var button = this.config.options[msg.id.split("_")[1]];
                    if(button) {
                        this.widget.setValue("state", button.value);
                        this.widget.sendStatusToFlow("set", msg.sessionId);

                        for(var i in this.config.options) {
                            this.widget.sendToDashbored(this.id + "_" + i, msg.sessionId, button.value);
                        }
                    }
                }
            },

            //When a message comes from a node red flow
            onFlowMessage: function (msg) {
                // if (msg.payload && msg.payload.state) {
                //     this.widget.setValue("state", msg.payload.state);
                //     this.widget.sendToDashbored(this.id, msg.sessionId, msg.payload.state);
                // }
            },

            //Generate the CSS for the widget
            generateCSS: function () {
                return this.config.CSS;
            },

            //Generate the HTML for the widget that will be inserted into the dashbored
            generateHTML: function (htmlId) {
                var buttonCSS = `
                    .on {
                        background-color: #32CD32;
                        color: black;
                    }
                    .off {
                        background-color: #800000;
                        color: black;
                    }
                    #button {
                        width: calc(100% - 10px);
                        height: calc(100% - 10px);
                        margin: 5px;
                    }
                    #widget {
                        background-color: red;
                        margin-bottom: 0;
                        margin-top: 0;
                        height: 100%;
                    }
                `;

                //TODO pass password actions etc to the buttons

                var ret = "";
                for (var i in this.config.options) {
                    console.log(this.config.options[i])
                    var button = this.config.options[i];
                    ret += this.util.generateTag(this.id, "widget", i, "", `type="toggleButton" CSS="${buttonCSS}" text="${button.label}" onValue="${button.value}" offValue="off"`);
                }
                return ret;
            },

            //Generate the script that will be executed when the dashbored loads
            generateOnload: function (htmlId, lockedAccess, alwaysPassword, ask, askText) {
                return "";
            },

            //Generate the script that will be called when a message comes from NodeRed on the dashbored
            generateOnMsg: function (htmlId) {
                return "";
            },

            //Generate any extra scripts to add to the document
            generateScript: function () { },
        }
    }
}