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
  // Tarkistaa perutut kun ohjelma käynnistyy
  poikkeukset.tarkistaPerutut()

  // Tarkistaa perutut joka minuutti
  cron.schedule('* * * * *', () => {
    perutut.tarkistaPerutut(1).catch(err => { console.error(err) })
  })

  // Tarkistaa poistettavat viestit joka kymmenes minuutti
  cron.schedule('*/5 * * * *', () => {
    perutut.perututViestiPoisto().catch(err => { console.error(err) })
  })
}

if (config.enablePoikkeukset === true) {
  // Tarkistaa poikkeukset kun ohjelma käynnistyy
  poikkeukset.tarkistaPoikkeukset()

  // Tarkistaa poikkeukset joka minuutti
  cron.schedule('* * * * *', () => {
    poikkeukset.tarkistaPoikkeukset(1).catch(err => { console.error(err) })
  })

  // Tarkistaa poistettavat viestit joka 5 minuutti
  cron.schedule('*/5 * * * *', () => {
    poikkeukset.poikkeusViestiPoisto().catch(err => { console.error(err) })
  })
}

/**
 *
 *  Muuta
 *
 */

// Debug mode, eli jos tarvitaan vaikka uuden kanavan ID:tä, niin tämä tulostaa kaikki tulevat viestit konsoliin
if (config.enablePolling === true) {
  console.info('Polling mode enabled')
  bot.on('channel_post', msg => {
    console.log(msg)
  })
}
