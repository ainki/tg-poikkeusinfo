//
//  PoikkeusinfoBot
//

//NPM
const TeleBot = require('telebot');
require('dotenv').config()


//Heroku token
const token = process.env.token;

//BotToken
const bot = new TeleBot({
    token: token,
});

module.exports = bot;