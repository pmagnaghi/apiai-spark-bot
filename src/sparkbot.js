'use strict';

const apiai = require('apiai');
const uuid = require('node-uuid');
const request = require('request');

import assert from 'assert';
import ciscospark from 'ciscospark/es6';

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
        this.createWebhook(this._webhookUrl);
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
                                    this.reply(chatId, responseText);
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

    createWebhook(webhookUrl) {
        return ciscospark.rooms.create({title: 'Webhook Example'})
            .then(function (room) {
                return ciscospark.webhooks.create({
                    resource: 'messages',
                    event: 'created',
                    //filter: 'roomId=' + room.id,
                    targetUrl: webhookUrl,
                    name: 'Test Webhook'
                });
            })
            .then(function (webhook) {
                assert(webhook.id);
                assert(webhook.resource);
                assert(webhook.event);
                assert(webhook.filter);
                assert(webhook.targetUrl);
                assert(webhook.name);
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