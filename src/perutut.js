// HSL perutut vuorot

// Import
const bot = require('../bot')
const config = require('../config')
// npm
const { request } = require('graphql-request')
var Loki = require('lokijs')
const moment = require('moment')
moment.locale('fi-FI')

// Tietokanta
var peruttuViestit
var db = new Loki('./data/perutut.db',
  {
    autoload: true,
    autosave: true,
    autosaveInterval: 30000,
    autoloadCallback: databaseInitialize
  }
)

// implement the autoloadback referenced in loki constructor
function databaseInitialize () {
  console.info('[HSL Cancelled] Ladataan tietokanta...')
  peruttuViestit = db.getCollection('perututuViestit')
  if (peruttuViestit === null) {
    console.info('[HSL Cancelled] Tietokantaa ei löytynyt, luodaan uusi...')
    peruttuViestit = db.addCollection('perututuViestit')
  }

  // kick off any program logic or start listening to external events
  tarkistaPerutut()
  console.info('[HSL Cancelled] Tietokanta ladattu:')
  console.log(peruttuViestit.data)
}

const listaPerutuista = []

// Poikkeusten hakufunktio
async function tarkistaPerutut (tila) {
  // graphQL hakulause
  const query = `{
    cancelledTripTimes {
      scheduledDeparture
      realtimeState
      headsign
      serviceDay
      trip {
        routeShortName
        tripHeadsign
        id
        pattern {
          route {
          mode
        }
      }
    }
    }
    }`

  const data = await request(config.digitransitAPILink, query)
  // Datan käsittely
  const perututVuorot = data.cancelledTripTimes
  // Käy läpi jokaisen perutun vuoron
  for (let i = 0; i < perututVuorot.length; i += 1) {
    // Tarkistaa onko peruttu vuoro jo olemassa
    if (listaPerutuista.indexOf(perututVuorot[i].trip.id) === -1) {
      var tripId = perututVuorot[i].trip.id
      // Lisää uuden perutun peruttuihin, jotta se ei toistu
      listaPerutuista.push(perututVuorot[i].trip.id)
      // Ajan käsittely
      var departureTimeNum = Number(perututVuorot[i].scheduledDeparture)
      var serviceDayNum = Number(perututVuorot[i].serviceDay)

      var alertEndDate = departureTimeNum + 7200 + serviceDayNum  // Lisää kaksi tuntia lähtöajan päälle tietokantaa varten
      // var alertEndDate = departureTimeNum + 180 + serviceDayNum // Kolme minuuttia (testausta varten)

      // Viesti
      let lahetettavaViesti

      // Vuoron perumisen päivämäärä
      if (moment.unix(Number(perututVuorot[i].serviceDay) + departureTimeNum).format('L') === moment().format('L')) {
        lahetettavaViesti = perututVuorot[i].trip.routeShortName + ' ' + perututVuorot[i].trip.tripHeadsign + ' klo ' + moment.unix(Number(perututVuorot[i].serviceDay) + departureTimeNum).format('HH:mm') + ' on peruttu'
      } else {
        lahetettavaViesti = perututVuorot[i].trip.routeShortName + ' ' + perututVuorot[i].trip.tripHeadsign + ' ' + moment.unix(Number(perututVuorot[i].serviceDay) + departureTimeNum).format('L') + ' klo ' + moment.unix(Number(perututVuorot[i].serviceDay) + departureTimeNum).format('HH:mm') + ' on peruttu'
      }
      // Lisää viestin alkuun merkin jos kulkuneivo tiedossa
      var mode = perututVuorot[i].trip.pattern.route.mode
      if (perututVuorot[i].trip.pattern.route.mode) {
        switch (mode) {
          case 'BUS': lahetettavaViesti = 'Ⓑ ' + lahetettavaViesti
            break
          case 'SUBWAY': lahetettavaViesti = 'Ⓜ ' + lahetettavaViesti
            break
          case 'TRAM': lahetettavaViesti = 'Ⓡ ' + lahetettavaViesti
            break
          case 'RAIL': lahetettavaViesti = 'Ⓙ ' + lahetettavaViesti
            break
          case 'FERRY': lahetettavaViesti = 'Ⓛ ' + lahetettavaViesti
            break
          default:
            // lahetettavaViesti = lahetettavaViesti
            break
        }
      }
      console.log('[HSL Cancelled] ' + lahetettavaViesti) // Logataan alert konsoliin

      // Tarkistetaan onko ensimmäinen haku, vaikuttaa viestien lähettämiseen
      if (tila === 1) {
        const lahetettyViesti = await bot.sendMessage(config.poikkeusChannelID, lahetettavaViesti)
        const msgId = lahetettyViesti.message_id
        perututVuorotViestiLista(tripId, msgId, alertEndDate, lahetettavaViesti)
      }
    }
  }
}

function perututVuorotViestiLista (tripId, msgId, effectiveEndDate, messageBody) {
  peruttuViestit.insert({
    cancelTripId: tripId,
    cancelMsgId: msgId,
    cancelEndDate: effectiveEndDate,
    cancelMessage: messageBody
  })
  db.saveDatabase()
}

function perututViestiPoisto () {
  // console.debug('[HSL Peruttu] Tarkistetaan poistettavia peruttu viestejä');
  // Hakee tietokannasta viestit jotka on vanhempia kuin 3 tuntia
  var poistettavatViestit = peruttuViestit.chain()
    .find({ cancelEndDate: { $lt: moment().unix() } })
    .data()

  for (let i = 0; i < poistettavatViestit.length; i += 1) {
    var viestiID = poistettavatViestit[i].cancelMsgId
    // console.log('Poistetaan viesti ID: ' + viestiID);
    peruttuViestit.chain().find({ cancelMsgId: viestiID }).remove()
    db.saveDatabase()
    bot.deleteMessage(config.poikkeusChannelID, viestiID).then(re => {
      // console.debug('Poistettu viesti: ' + poistettavatViestit[i].cancelMsgId);
    }).catch(err => {
      console.error(err)
      if (err.response.body.error_code === 400) {
        console.debug('Viestiä ei löytynyt, poistetaan tietokannasta')
        peruttuViestit.chain().find({ cancelMsgId: viestiID }).remove()
      }
    })
  }

  db.saveDatabase()
  // console.debug('Tietokanta poiston jälkeen: ')
  // console.debug(peruttuViestit.data)
}

module.exports = {
  tarkistaPerutut,
  perututViestiPoisto
}
