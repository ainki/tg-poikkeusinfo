const pjson = require('./package.json');
const bot = require('./bot')
const config = require('./config')
const poikkeukset = require('./src/poikkeukset')
const perutut = require('./src/perutut')

var cron = require('node-cron');
require('console-stamp')(console, 'HH:MM:ss'); //Aikaleimat logiin

// Start message
function startMessage() {
    console.info(`\n\nainki-tg-poikkeusinfo\nVersio: ${pjson.version}\n\nModuulit: \n` + Object.entries(config).join('\n') + `\n\nKäynnistetty!\n`);
}

startMessage()

if (config.enablePerutut == true) {
    // Käynnistyksen yhteydessä tehtävä haku
    perutut.tarkistaPerutut();

    // Tarkistaa poikkeukset joka minuutti
    cron.schedule('* * * * *', () => {
        perutut.tarkistaPerutut(1);
    });
    // Tarkistaa poistettavat viestit joka viides minuutti
    cron.schedule('*/5 * * * *', () => {
        perutut.perututViestiPoisto();
    });
}

if (config.enablePoikkeukset == true) {
    // Käynnistyksen yhteydessä tehtävä haku
    poikkeukset.tarkistaPoikkeukset();

    // Tarkistaa poikkeukset joka toinen minuutti
    cron.schedule('*/2 * * * *', () => {
        poikkeukset.tarkistaPoikkeukset(1);
    });
}

/**
 * 
 *  Muuta
 * 
 */

// Debug mode, eli jos tarvitaan vaikka uuden kanavan ID:tä, niin tämä tulostaa kaikki tulevat viestit konsoliin
if (config.enableDebug == true) {
    console.log('Debug mode enabled');
    bot.on('text', function (msg) {
        console.log(`[text] ${msg.chat.id}: ${msg.text}`);
    });
    bot.start();
}