const pjson = require('./package.json')
const bot = require('./bot')
const config = require('./config')
const poikkeukset = require('./src/poikkeukset')
const perutut = require('./src/perutut')

var cron = require('node-cron')
require('console-stamp')(console, 'HH:MM:ss') // Aikaleimat logiin

// Start message
function consoleStartMessage () {
  console.info(`\n\nainki-tg-poikkeusinfo\nVersio: ${pjson.version}\n\nModuulit: \n` + Object.entries(config).join('\n') + '\n\nKäynnistetty!\n')
}

consoleStartMessage()

if (config.enablePerutut === true) {
  // Tarkistaa perutut joka minuutti
  cron.schedule('* * * * *', () => {
    perutut.tarkistaPerutut(1)
      .catch(err => {
        console.error(err)
      })
  })

  // Tarkistaa poistettavat viestit joka viides minuutti
  cron.schedule('*/5 * * * *', () => {
    perutut.perututViestiPoisto()
  })
}

if (config.enablePoikkeukset === true) {
  // Tarkistaa poikkeukset joka toinen minuutti
  cron.schedule('*/2 * * * *', () => {
    poikkeukset.tarkistaPoikkeukset(1)
      .catch(err => {
        console.error(err)
      })
  })

  // Tarkistaa poistettavat viestit joka seitsemäs minuutti
  cron.schedule('*/7 * * * *', () => {
    poikkeukset.poikkeusViestiPoisto()
  })
}

/**
 *
 *  Muuta
 *
 */

// Debug mode, eli jos tarvitaan vaikka uuden kanavan ID:tä, niin tämä tulostaa kaikki tulevat viestit konsoliin
if (config.enableDebug === true) {
  console.log('Debug mode enabled')
  bot.on('channel_post', msg => {
    // console.log(`[text] ${msg.chat.id}: ${msg.text}`)
    console.log(msg)
  })
}
