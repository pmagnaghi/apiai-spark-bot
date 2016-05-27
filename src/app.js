'use strict';

const apiai = require('apiai');
const express = require('express');
const bodyParser = require('body-parser');

const SparkBot = require('./sparkbot');
const SparkBotConfig = require('./sparkbotconfig');

const REST_PORT = (process.env.PORT || 5000);
const DEV_CONFIG = process.env.DEVELOPMENT_CONFIG == 'true';

const APP_NAME = process.env.APP_NAME;
const APIAI_ACCESS_TOKEN = process.env.APIAI_ACCESS_TOKEN;
const APIAI_LANG = process.env.APIAI_LANG;
const SPARK_TOKEN = process.env.SPARK_TOKEN;

var baseUrl = "";
if (APP_NAME) {
    // Heroku case
    baseUrl = `https://${APP_NAME}.herokuapp.com`;
} else {
    console.error('Set up the url of your service here and remove exit code!');
    process.exit(1);
}

// console timestamps
require('console-stamp')(console, 'yyyy.mm.dd HH:MM:ss.l');

const botConfig = new SparkBotConfig(
    APIAI_ACCESS_TOKEN,
    APIAI_LANG,
    SPARK_TOKEN);

botConfig.devConfig = DEV_CONFIG;

const bot = new SparkBot(botConfig, baseUrl);
bot.start(() => {
        console.log("Bot started");
    },
    (errStatus) => {
        console.error('It seems the SPARK_TOKEN is wrong! Please fix it.')
    });


const app = express();
app.use(bodyParser.json());

app.post('/webhook', (req, res) => {
    console.log('POST webhook');

    try {
        bot.processMessage(req, res);
    } catch (err) {
        return res.status(400).send('Error while processing ' + err.message);
    }
});

app.listen(REST_PORT, function () {
    console.log('Rest service ready on port ' + REST_PORT);
});