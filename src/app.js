'use strict';

const apiai = require('apiai');
const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');

const SparkBot = require('./sparkbot');
const SparkBotConfig = require('./sparkbotconfig');

const REST_PORT = (process.env.PORT || 5000);
const DEV_CONFIG = process.env.DEVELOPMENT_CONFIG == 'true';

const APP_NAME = process.env.APP_NAME;
const APIAI_ACCESS_TOKEN = process.env.APIAI_ACCESS_TOKEN;
const APIAI_LANG = process.env.APIAI_LANG;

const SPARK_CLIENT_ID = process.env.SPARK_CLIENT_ID;
const SPARK_CLIENT_SECRET = process.env.SPARK_CLIENT_SECRET;

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

function startBot(accessToken) {

    console.log("Starting bot");

    const botConfig = new SparkBotConfig(
        APIAI_ACCESS_TOKEN,
        APIAI_LANG,
        accessToken);

    botConfig.devConfig = DEV_CONFIG;

    const bot = new SparkBot(botConfig, baseUrl);
    
    bot.createRoom("Test Room");
}

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

app.get('/auth', (req, res) => {
    console.log('GET auth', req.query);

    var code = req.query.code;

    if (code) {
    request.post('https://api.ciscospark.com/v1/access_token',
        {
            form: {
                grant_type: 'authorization_code',
                code: code,
                client_id: SPARK_CLIENT_ID,
                client_secret: SPARK_CLIENT_SECRET,
                    redirect_uri: baseUrl + '/auth'
            }
        }, (err, authResp) => {
            // {
            //     "access_token":"ZDI3MGEyYzQtNmFlNS00NDNhLWFlNzAtZGVjNjE0MGU1OGZmZWNmZDEwN2ItYTU3",
            //     "expires_in":1209600, //seconds
            //     "refresh_token":"MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQ1Njc4OTEyMzQ1Njc4",
            //     "refresh_token_expires_in":7776000 //seconds
            // }

            console.log(authResp.body);

            if (!err) {
                    let response = JSON.parse(authResp.body);

                    let accessToken = response.access_token;

                if (accessToken) {
                    startBot(accessToken);

                    console.log("Return OK status");
                    res.status(200).send("OK");
                } else {
                    console.log("AccessToken is empty");
                    res.status(400).send("AccessToken is empty");
                }
            } else {
                console.error("Can't auth:", err);
                res.status(400).send("Can't auth");
            }
        })
    } else {
        res.sendFile('html/success.html', {root: __dirname});
    }
    
});

app.get('/success', (req, res) => {
    res.sendFile('html/success.html', {root: __dirname});
});

app.get('/sample', (req, res) => {
    res.sendFile('html/sample.html', {root: __dirname});
});

app.listen(REST_PORT, () => {
    console.log('Rest service ready on port ' + REST_PORT);
});