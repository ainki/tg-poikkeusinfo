// HSL perutut vuorot

// Import
const bot = require('../bot')
const config = require('../config')
const modes = require('./components/modeIcon')
// npm
const { request } = require('graphql-request')
const moment = require('moment')
moment.locale('fi-FI')
const db = require('./dbController').db

// Consts
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

      var alertEndDate = departureTimeNum + 5400 + serviceDayNum // Lisää kaksi tuntia lähtöajan päälle tietokantaa varten
      // var alertEndDate = departureTimeNum + 180 + serviceDayNum // Kolme minuuttia (testausta varten)
      // Tarkistaa onko peruttu vuoro relevantti enään
      if (alertEndDate > moment().unix()) {
        // Viesti
        let lahetettavaViesti

        // Vuoron perumisen päivämäärä
        if (moment.unix(Number(perututVuorot[i].serviceDay) + departureTimeNum).format('L') === moment().format('L')) {
          lahetettavaViesti = perututVuorot[i].trip.routeShortName + ' ' + perututVuorot[i].trip.tripHeadsign + ' klo ' + moment.unix(Number(perututVuorot[i].serviceDay) + departureTimeNum).format('HH:mm') + ' on peruttu'
        } else {
          lahetettavaViesti = perututVuorot[i].trip.routeShortName + ' ' + perututVuorot[i].trip.tripHeadsign + ' ' + moment.unix(Number(perututVuorot[i].serviceDay) + departureTimeNum).format('L') + ' klo ' + moment.unix(Number(perututVuorot[i].serviceDay) + departureTimeNum).format('HH:mm') + ' on peruttu'
        }
        var mode = perututVuorot[i].trip.pattern.route.mode
        lahetettavaViesti = modes.modeSwitch(mode) + lahetettavaViesti // Lisää viestin alkuun merkin jos kulkuneivo tiedossa, mode switch functiossa
        console.log('[HSL C] ' + lahetettavaViesti) // Logataan alert konsoliin
        // Tarkistetaan onko ensimmäinen haku, vaikuttaa viestien lähettämiseen
        if (tila === 1) {
          const lahetettyViesti = await bot.sendMessage(config.poikkeusChannelID, lahetettavaViesti, { disable_notification: true })
          const msgId = lahetettyViesti.message_id
          if (config.enableDebug === true) {
            // console.debug(lahetettyViesti)
          }
          await perututVuorotViestiDb(tripId, msgId, alertEndDate, lahetettavaViesti)
        }
      }
    }
  }
}

function perututVuorotViestiDb (tripId, msgId, effectiveEndDate, messageBody) {
  const insertSQL = 'INSERT INTO perututvuorot (cancel_trip_id, cancel_msg_id, cancel_end_date, cancel_message) VALUES (?, ?, ?, ?)'
  db.run(insertSQL, [tripId, msgId, effectiveEndDate, messageBody], (err) => {
    if (err) {
      console.error(err)
    } else {
      // console.log(`Row inserted with ID ${this.lastID}`)
    }
  })
}

async function perututViestiPoisto () {
  // SQL query to select rows where the integer column is less than the target value
  const sqlQuery = 'SELECT * FROM perututvuorot WHERE cancel_end_date < ?'
  db.all(sqlQuery, moment().unix(), (err, rows) => {
    if (err) {
      return console.error(err)
    }
    if (rows.length !== 0) {
      // console.info('[HSLC delete] Messages to be deleted:')
      // console.debug(rows)
      rows.forEach((row) => {
        // console.log(row)
        bot.deleteMessage(config.poikkeusChannelID, row.cancel_msg_id).then(re => {
          const removeSQL = 'DELETE FROM perututvuorot WHERE cancel_message = ?'
          db.run(removeSQL, row.cancel_message, (err) => {
            if (err) {
              console.error(err)
            } else {
              console.log('[HSL C del] ' + row.cancel_message)
            }
          })
        }).catch(err => {
          console.error('[HSL C del] TELEGRAM: ' + err.response.body.error_code + ' ' + err.response.body.description + ' | ' + row.alert_msg_id)
          if (err.response.body.error_code === 400) {
            console.log('[HSL C del] Message "' + row.cancel_message + '" cannot be found, deleting from database')
            const removeSQL = 'DELETE FROM perututvuorot WHERE cancel_message = ?'
            db.run(removeSQL, row.cancel_message, (err) => {
              if (err) {
                console.error(err)
              } else {
                console.info('[HSL C del] Row deleted successfully')
              }
            })
          }
        })
      })
    }
  })
}

module.exports = {
  tarkistaPerutut,
  perututViestiPoisto
}
