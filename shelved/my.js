"use strict";
const commando = require("discord.js-commando");
const MyParser = require("../../lib/myParser");
const Utils = require("../../lib/utils");

//!info command
class info extends commando.Command {
    constructor(client) {
        super(client, {
            name: "my",
            group: "player",
            memberName: "my",
            description: "get/set information about the user",
            examples: ["!my info", "!my cities", "!my cities are redmond,education hill"],
        });
    }

    formatGymOptions(title, options) {
        let messages = [title];
        [
            { field: "requiredZones", label: "Required Zones: " },
            { field: "requiredCities", label: "Required Cities: " },
            { field: "preferredZones", label: "Preferred Zones: " },
            { field: "preferredCities", label: "Preferred Cities: " },
        ].forEach((field) => {
            if (options[field.field] && (options[field.field].length > 0)) {
                let setting = options[field.field].join(", ");
                messages.push(`${field.label}${setting}`);
            }
        });
        return (messages.length > 1) ? messages : [];
    }

    addFormattedGymOptions(output, title, options) {
        let needBreak = (output.length > 0);
        this.formatGymOptions(title, options).forEach((line) => {
            if (needBreak) {
                output.push("");
                needBreak = false;
            }
            output.push(line);
        });
    }

    async run(message) {
        var client = message.client;
        var output = "Processing !my command submitted by user " + message.author +  "\n";
        process.stdout.write(output);
        message.channel.send(output);

        let want = undefined;
        try {
            want = MyParser.tryParse(message.content, client.raidManager.gyms);
        }
        catch (err) {
            client.reportError(message, "!my", err);
        }

        // if no arguments provided (null or empty string) or error
        if (!want) {
            client.reportError(
                message,
                "!my",
                "My circuitzzz are tingling! I didn't understand that command..."
            );
            return;
        }

        let infoOutput = [];
        let config = client.config.getServerConfigForMessage(message);
        if (config && config.gymLookupOptions) {
            this.addFormattedGymOptions(infoOutput, "Server lookup settings:", config.gymLookupOptions);
        }

        config = client.config.getUserConfigForMessage(message);
        if (want.update) {
            let options = (config ? Utils.mergeOptions(config.gymLookupOptions, want.update) : want.update);
            config = client.config.updateGymLookupOptionsForMessage(message, options);
        }

        if (config && config.gymLookupOptions) {
            this.addFormattedGymOptions(infoOutput, "User lookup settings:", config.gymLookupOptions);
        }

        if (infoOutput.length > 0) {
            message.channel.send(infoOutput.join("\n"));
        }
        else {
            message.channel.send("No settings");
        }
    }
}

module.exports = info;
