// HSL Poikkeukset

const bot = require('../bot')
const config = require('../config')
// paketit
const { request } = require('graphql-request')
var Loki = require('lokijs')
var moment = require('moment')
moment.locale('fi-FI')

// Tietokanta viesteille
var poikkeusViestit
var db = new Loki('./data/poikkeus.db',
  {
    autoload: true,
    autosave: true,
    autosaveInterval: 60000,
    autoloadCallback: databaseInitialize
  }
)

// implement the autoloadback referenced in loki constructor
function databaseInitialize () {
  console.info('[HSL Alert] Ladataan tietokanta...')
  poikkeusViestit = db.getCollection('poikkeusViestit')
  if (poikkeusViestit === null) {
    console.info('[HSL Alert] Tietokantaa ei löytynyt, luodaan uusi...')
    poikkeusViestit = db.addCollection('poikkeusViestit')
  }
  // kick off any program logic or start listening to external events
  tarkistaPoikkeukset()
  console.info('[HSL Alert] Tietokanta ladattu:')
  console.log(poikkeusViestit.data)
}

const poikkeukset = []

// Hae poikeukset
async function tarkistaPoikkeukset (tila) {
  // graphQL hakulause
  const query = `
    {
      alerts {
        id
        alertHeaderText
        alertDescriptionText
        alertEffect
        alertSeverityLevel
        effectiveStartDate
        effectiveEndDate
        route {
          mode
        }
      }
    }`

  const data = await request(config.digitransitAPILink, query)
  // Datan käsittely
  const alerts = data.alerts
  // Menee jokaisen poikkeuksen läpi
  for (let i = 0; i < alerts.length; i += 1) {
  // Tarkistaa onko poikkeus jo olemassa
    if (poikkeukset.indexOf(alerts[i].alertDescriptionText) === -1) {
      // Lisää uuden alertin poikkeuksiin, jotta se ei toistu
      poikkeukset.push(alerts[i].alertDescriptionText)

      var lahetettavaViesti
      let alertId = alerts[i].id
      var alertDescription = alerts[i].alertDescriptionText // Poikkeuksen kuvaus
      var alertSeverity = alerts[i].alertSeverityLevel // Poikkeuksen tärkeys
      var alertEndDate = alerts[i].effectiveEndDate // Poikkeuksen effectiveEndDate
      // Lisätään poikkeukselle 3 tuntia lisää, jotta poikkeus ei katoa liian nopeasti
      alertEndDate = Number(alertEndDate) + 10800

      // Tarkastaa onko poikkeuksella kulkuneuvo ja rakentaa viestin
      if (!alerts[i].route) {
        lahetettavaViesti = '<b>' + alerts[i].alertHeaderText + '</b>\n' + alerts[i].alertDescriptionText
      } else {
        var mode = alerts[i].route.mode
        // Lisää viestin alkuun merkin
        switch (mode) {
          case 'BUS': lahetettavaViesti = 'Ⓑ <b>' + alerts[i].alertHeaderText + '</b>\n' + alerts[i].alertDescriptionText
            break
          case 'SUBWAY': lahetettavaViesti = 'Ⓜ <b>' + alerts[i].alertHeaderText + '</b>\n' + alerts[i].alertDescriptionText
            break
          case 'TRAM': lahetettavaViesti = 'Ⓡ <b>' + alerts[i].alertHeaderText + '</b>\n' + alerts[i].alertDescriptionText
            break
          case 'RAIL': lahetettavaViesti = 'Ⓙ <b>' + alerts[i].alertHeaderText + '</b>\n' + alerts[i].alertDescriptionText
            break
          case 'FERRY': lahetettavaViesti = 'Ⓛ <b>' + alerts[i].alertHeaderText + '</b>\n' + alerts[i].alertDescriptionText
            break
          default:
            lahetettavaViesti = '<b>' + alerts[i].alertHeaderText + '</b>\n' + alerts[i].alertDescriptionText
            break
        }
      }
      // Logataan poikkeus konsoliin
      console.log('[HSL Alert] ' + alertDescription) // Logataan alert konsoliin
      // Tarkistetaan function tila, jos tila on '1' lähetetään viesti(t)
      if (tila === 1) {
        const lahetettyViesti = await bot.sendMessage(config.poikkeusChannelID, lahetettavaViesti, { parse_mode: 'HTML' })
        const msgId = lahetettyViesti.message_id
        poikkeusViestiListaus(alertId, alertDescription, msgId, alertEndDate)
        if (alertSeverity === 'SEVERE') {
          const pinned = await bot.pinChatMessage(config.poikkeusChannelID, msgId)
          console.info('[HSL Alert] Viesti ' + pinned.message_id + ' pinnattu')
        }
      }
    }
  }
}

function poikkeusViestiListaus (id, description, msgId, endDate) {
  poikkeusViestit.insert({
    alertId: id,
    alertDescription: description,
    alertMessageId: msgId,
    alertEndDate: endDate
  })
  db.saveDatabase()
}

async function poikkeusViestiUpdate () {
  
}

async function poikkeusViestiPoisto () {
  // console.debug('[HSL Alert] Tarkistetaan poistettavia poikkeusviestejä')

  var poistettavatViestit = poikkeusViestit.chain()
    .find({ alertEndDate: { $lt: moment().unix() } })
    .data()

  // Käydää jokainen poistettava läpi ja poistetaan viesti

  for (let i = 0; i < poistettavatViestit.length; i += 1) {
    var poistettavaViesti = poistettavatViestit[i].alertMessageId
    // console.debug('Poistettava viesti: ' + poistettavaViesti)
    // console.debug('Poistettava tripId: ' + poistettavaAlertDescription)
    poikkeusViestit.chain().find({ alertMessageId: poistettavaViesti }).remove()
    bot.deleteMessage(config.poikkeusChannelID, poistettavaViesti).then(re => {
      // console.debug('Poistettu viesti: ' + poistettavaViesti)
    }).catch(err => {
      console.error(err)
      if (err.code === 400) {
        console.error('[HSL Alert] Poistettava viesti ei löytynyt, poistetaan tietokannasta')
        poikkeusViestit.chain().find({ alertMessageId: poistettavaViesti }).remove()
      }
    })
  }
  db.saveDatabase()
}

module.exports = {
  tarkistaPoikkeukset,
  poikkeusViestiPoisto
}
