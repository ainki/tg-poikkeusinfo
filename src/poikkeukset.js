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
    autosaveInterval: 10000,
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
  // Tarkistaa onko päivitettäviä poikkeuksia
  await poikkeusViestiUpdate(alerts)
  // Menee jokaisen poikkeuksen läpi
  for (let i = 0; i < alerts.length; i += 1) {
    // Tarkistaa onko poikkeus jo olemassa
    if (poikkeukset.indexOf(alerts[i].alertDescriptionText) === -1) {
      // Lisää uuden alertin poikkeuksiin, jotta se ei toistu
      poikkeukset.push(alerts[i].alertDescriptionText)

      // var lahetettavaViesti
      const alertId = alerts[i].id
      var alertDescription = alerts[i].alertDescriptionText // Poikkeuksen kuvaus
      var alertSeverity = alerts[i].alertSeverityLevel // Poikkeuksen tärkeys
      var alertEndDate = alerts[i].effectiveEndDate // Poikkeuksen effectiveEndDate
      // Lisätään poikkeukselle 3 tuntia lisää, jotta poikkeus ei katoa liian nopeasti
      alertEndDate = Number(alertEndDate) + 10800

      var lahetettavaViesti = poikkeusViestiBuild(alerts[i])

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

// Viestin rakennus
function poikkeusViestiBuild (alertsi) {
  var lahetettavaViesti
  // Tarkastaa onko poikkeuksella kulkuneuvo ja rakentaa viestin
  if (!alertsi.route) {
    lahetettavaViesti = '<b>' + alertsi.alertHeaderText + '</b>\n' + alertsi.alertDescriptionText
  } else {
    var mode = alertsi.route.mode
    // Lisää viestin alkuun merkin
    switch (mode) {
      case 'BUS': lahetettavaViesti = 'Ⓑ <b>' + alertsi.alertHeaderText + '</b>\n' + alertsi.alertDescriptionText
        break
      case 'SUBWAY': lahetettavaViesti = 'Ⓜ <b>' + alertsi.alertHeaderText + '</b>\n' + alertsi.alertDescriptionText
        break
      case 'TRAM': lahetettavaViesti = 'Ⓡ <b>' + alertsi.alertHeaderText + '</b>\n' + alertsi.alertDescriptionText
        break
      case 'RAIL': lahetettavaViesti = 'Ⓙ <b>' + alertsi.alertHeaderText + '</b>\n' + alertsi.alertDescriptionText
        break
      case 'FERRY': lahetettavaViesti = 'Ⓛ <b>' + alertsi.alertHeaderText + '</b>\n' + alertsi.alertDescriptionText
        break
      default:
        lahetettavaViesti = '<b>' + alertsi.alertHeaderText + '</b>\n' + alertsi.alertDescriptionText
        break
    }
  }
  return lahetettavaViesti
}

// Tietokantaan tieto
function poikkeusViestiListaus (id, description, msgId, endDate) {
  poikkeusViestit.insert({
    alertId: id,
    alertDescription: description,
    alertMessageId: msgId,
    alertEndDate: endDate
  })
  // db.saveDatabase()
}

// Alertin päivitys
async function poikkeusViestiUpdate (alerts) {
  // console.log('poikkeusViestiUpdate')
  var kaikkiPoikkeusViestit = poikkeusViestit.chain().data()
  for (let y = 0; y < kaikkiPoikkeusViestit.length; y += 1) {
    for (let x = 0; x < alerts.length; x += 1) {
      if (kaikkiPoikkeusViestit[y].alertId === alerts[x].id) {
        // Jos tietokannan ja queryn alertDescription text eroaa
        if (kaikkiPoikkeusViestit[y].alertDescription !== alerts[x].alertDescriptionText) {
          // console.log('Not same text, update text')
          console.log('[HSL Alert update] >' + kaikkiPoikkeusViestit[y].alertDescription + '< to >' + alerts[x].alertDescriptionText + '<')
          // Lisää poikkeuksiin tiedot uudesta tekstistä, jotta ei tulis uutta viestiä
          poikkeukset.push(alerts[x].alertDescriptionText)
          // Tekee uuden endDaten
          var alertEndDate = alerts[x].effectiveEndDate
          alertEndDate = Number(alertEndDate) + 10800
          // Rakentaa viestin
          var editoituViesti = poikkeusViestiBuild(alerts[x])
          // Muokkaa viestin
          bot.editMessageText(editoituViesti, { chat_id: config.poikkeusChannelID, message_id: kaikkiPoikkeusViestit[y].alertMessageId, parse_mode: 'HTML' })
          // Päivittää tekstin tietokantaan
          poikkeusViestit.chain().find({ alertMessageId: kaikkiPoikkeusViestit[y].alertMessageId }).update(function (obj) {
            obj.alertDescription = alerts[x].alertDescriptionText
            obj.alertEndDate = alertEndDate
          })
        } else if (kaikkiPoikkeusViestit[y].alertEndDate !== Number(alerts[x].effectiveEndDate)) {
          // Jos tietokannan ja queryn endDate eroaa toisistaan
          console.log('[HSL Alert update] (End date changed) ' + alerts[x].alertDescriptionText)
          const alertEndDate = Number(alerts[x].effectiveEndDate) + 10800
          poikkeusViestit.chain().find({ alertMessageId: kaikkiPoikkeusViestit[y].alertMessageId }).update(function (obj) {
            obj.alertEndDate = alertEndDate
          })
        }
      }
    }
  }
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
      console.log('[HSL Alert Delete] ' + poistettavatViestit[i].alertDescription)
    }).catch(err => {
      console.error(err)
      if (err.error_code === 400) {
        console.error('[HSL Alert delete] Poistettavaa viestiä ei löytynyt, poistetaan tietokannasta')
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
