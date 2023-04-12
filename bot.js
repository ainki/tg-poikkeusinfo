//
//  Poikkeusinfo Telegram feed
//

// npm
const TelegramBot = require('node-telegram-bot-api')
require('dotenv').config()

// Telegram bot token
const token = process.env.token

const bot = new TelegramBot(token, { polling: false })

module.exports = bot
