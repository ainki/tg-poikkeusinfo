//
//  PoikkeusinfoBot
//

//NPM
// const TeleBot = require('telebot');
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config()



//Heroku token
const token = process.env.token;

//BotToken
const bot = new TelegramBot(
    token,
    {polling: false}
);

module.exports = bot;