'use strict';

const apiai = require('apiai');
const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const nconf = require('nconf');

const SparkBot = require('./sparkbot');
const SparkBotConfig = require('./sparkbotconfig');

const REST_PORT = (process.env.PORT || 5000);
const DEV_CONFIG = process.env.DEVELOPMENT_CONFIG == 'true';

const APP_NAME = process.env.APP_NAME;
const APIAI_ACCESS_TOKEN = process.env.APIAI_ACCESS_TOKEN;
const APIAI_LANG = process.env.APIAI_LANG;

const SPARK_CLIENT_ID = process.env.SPARK_CLIENT_ID;
const SPARK_CLIENT_SECRET = process.env.SPARK_CLIENT_SECRET;

var baseUrl = "https://c1cb1fca.ngrok.io";
// if (APP_NAME) {
//     // Heroku case
//     baseUrl = `https://${APP_NAME}.herokuapp.com`;
// } else {
//     console.error('Set up the url of your service here and remove exit code!');
//     process.exit(1);
// }

var bot;

// console timestamps
require('console-stamp')(console, 'yyyy.mm.dd HH:MM:ss.l');

nconf.use('file', {file: './config.json'});
nconf.load();

function startBot(accessToken) {

    console.log("Starting bot");

    const botConfig = new SparkBotConfig(
        APIAI_ACCESS_TOKEN,
        APIAI_LANG,
        accessToken);

    botConfig.devConfig = DEV_CONFIG;

    bot = new SparkBot(botConfig, baseUrl);
    bot.createRoom("ApiAi Room");

    persistBot(bot);
}

function persistBot(bot) {
    nconf.set('botConfig', bot.botConfig.toPlainDoc());
    nconf.save(function (err) {
        if (err) {
            console.error(err.message);
            return;
        }
        console.log('Configuration saved successfully.');
    });
}

function loadBot() {
    let botConfigJson = nconf.get('botConfig');
    if (botConfigJson) {
        let botConfig = SparkBotConfig.fromPlainDoc(botConfigJson);

        botConfig.devConfig = DEV_CONFIG;

        bot = new SparkBot(botConfig, baseUrl);
        console.log('Bot loaded');
    } else {
        console.log('Bot config not found');
    }
}

loadBot();

const app = express();
app.use(bodyParser.json());
app.set('views', './src/views');
app.set('view engine', 'jade');

app.post('/webhook', (req, res) => {
    console.log('POST webhook');

    try {
        if (bot) {
            bot.processMessage(req, res);
        }
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
                        res.render('success');
                    } else {
                        console.log("AccessToken is empty");
                        res.render('error', {
                            error_message: "AccessToken is empty"
                        });
                    }
                } else {
                    console.error("Can't auth:", err);

                    res.render('error', {
                        error_message: "Can't auth"
                    });
                }
            })
    }
    else if (req.query.error) {
        res.render('error', {
            error_message: req.query.error_description
        });
    }
    else {
        res.render('success');
    }

});

app.get('/success', (req, res) => {
    res.render('success');
});

app.listen(REST_PORT, () => {
    console.log('Rest service ready on port ' + REST_PORT);
});