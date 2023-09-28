//
//  Poikkeusinfo Telegram feed
//

// npm
const TelegramBot = require('node-telegram-bot-api')
require('dotenv').config()
const config = require('./config')

// Telegram bot token
const token = process.env.token
const options = { polling: config.enablePolling }

const bot = new TelegramBot(token, options)

module.exports = bot
