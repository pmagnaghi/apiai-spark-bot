'use strict';

const apiai = require('apiai');
const uuid = require('node-uuid');
const request = require('request');

module.exports = class SparkBot {

    get apiaiService() {
        return this._apiaiService;
    }

    set apiaiService(value) {
        this._apiaiService = value;
    }

    get botConfig() {
        return this._botConfig;
    }

    set botConfig(value) {
        this._botConfig = value;
    }

    get sessionIds() {
        return this._sessionIds;
    }

    set sessionIds(value) {
        this._sessionIds = value;
    }

    constructor(botConfig, baseUrl) {
        this._botConfig = botConfig;
        var apiaiOptions = {
            language: botConfig.apiaiLang,
            requestSource: "spark"
        };

        this._apiaiService = apiai(botConfig.apiaiAccessToken, apiaiOptions);
        this._sessionIds = new Map();

        this._webhookUrl = baseUrl + '/webhook';
        console.log('Starting bot on ' + this._webhookUrl);
    }

    start(responseCallback, errCallback) {
        console.log("Trying start bot");

        request.post("https://api.ciscospark.com/v1/webhooks",
            {
                auth: {
                    bearer: this._botConfig.sparkToken
                },
                json: {
                    event: "created",
                    name: "Test",
                    resource: "messages",
                    targetUrl: this._webhookUrl,
                    filter: 'roomId=Y2lzY29zcGFyazovL3VzL1JPT00vYmJjZWIxYWQtNDNmMS0zYjU4LTkxNDctZjE0YmIwYzRkMTU0'
                }
            }, (err, resp, body) => {
                if (err) {
                    console.error("Bot start error", err);
                    errCallback("Bot start error");
                }
                else if (resp.statusCode > 200) {
                    let message = resp.statusMessage;
                    if (resp.body.message) {
                        message += ", " + resp.body.message;
                    }
                    errCallback(message);
                }
                else {
                    console.log("Start result", resp.body);
                    responseCallback();
                }
            });
    }

    /*
     Process message from Spark
     details here https://developer.ciscospark.com/webhooks-explained.html
     */
    processMessage(req, res) {
        if (this._botConfig.devConfig) {
            console.log("body", req.body);
        }

        let updateObject = req.body;
        if (updateObject.resource == "messages" &&
            updateObject.data &&
            updateObject.data.id) {

            this.loadMessage(updateObject.data.id)
                .then((msg)=> {
                    let messageText = msg.text;
                    let chatId = msg.roomId;

                    if (messageText && chatId) {
                        console.log(chatId, messageText);

                        if (!this._sessionIds.has(chatId)) {
                            this._sessionIds.set(chatId, uuid.v1());
                        }

                        let apiaiRequest = this._apiaiService.textRequest(messageText,
                            {
                                sessionId: this._sessionIds.get(chatId)
                            });

                        apiaiRequest.on('response', (response) => {
                            if (SparkBot.isDefined(response.result)) {
                                let responseText = response.result.fulfillment.speech;

                                if (SparkBot.isDefined(responseText)) {
                                    console.log('Response as text message');
                                    this.reply(chatId, responseText).then((answer) => {
                                        console.log('Reply answer:', answer);
                                    });
                                    SparkBot.createResponse(res, 200, 'Reply sent');

                                } else {
                                    console.log('Received empty speech');
                                    SparkBot.createResponse(res, 200, 'Received empty speech');
                                }
                            } else {
                                console.log('Received empty result');
                                SparkBot.createResponse(res, 200, 'Received empty result');
                            }
                        });

                        apiaiRequest.on('error', (error) => {
                            console.error('Error while call to api.ai', error);
                            SparkBot.createResponse(res, 200, 'Error while call to api.ai');
                        });
                        apiaiRequest.end();
                    }
                })
        }

    }

    reply(roomId, text) {
        return ciscospark.messages.create({
            text: text,
            roomId: roomId
        });
    }
    
    loadMessage(messageId) {
        return ciscospark.messages.get(messageId);
    }

    static createResponse(resp, code, message) {
        return resp.status(code).json({
            status: {
                code: code,
                message: message
            }
        });
    }

    static isDefined(obj) {
        if (typeof obj == 'undefined') {
            return false;
        }

        if (!obj) {
            return false;
        }

        return obj != null;
    }
}