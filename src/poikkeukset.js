// HSL Poikkeukset

const bot = require('../bot')
const config = require('../config')
const modes = require('./components/modeIcon')
// paketit
const { request } = require('graphql-request')
var moment = require('moment')
moment.locale('fi-FI')
const db = require('./dbController').db

// Consts
const poikkeukset = []

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

  const data = await request(config.digitransitAPILink, query) // Api query
  // Datan käsittely ->
  const alerts = data.alerts
  try {
    await poikkeusViestiUpdate(alerts)
    newAlert(alerts)
  } catch (error) {
    console.error(error)
  }
}

async function newAlert (alerts, tila) {
  // Menee jokaisen poikkeuksen läpi
  for (let i = 0; i < alerts.length; i += 1) {
    if (alerts[i].effectiveStartDate < moment().unix()) {
      if (poikkeukset.indexOf(alerts[i].alertDescriptionText) === -1) { // Tarkistaa onko poikkeus jo olemassa
        poikkeukset.push(alerts[i].alertDescriptionText) // Lisää uuden alertin poikkeuksiin, jotta se ei toistu
        // Filteröidään INFO ja NO_EFFECT pois
        if (alerts[i].alertSeverityLevel === 'INFO' && alerts[i].alertEffect === 'NO_EFFECT') {
          // Do nothing for now
        } else {
          let alertEndDate = alerts[i].effectiveEndDate // Poikkeuksen effectiveEndDate
          alertEndDate = Number(alertEndDate) + 3600 // Lisätään poikkeukselle tunti lisää, jotta poikkeus ei katoa liian nopeasti
          const lahetettavaViesti = poikkeusViestiBuild(alerts[i]) // Viestin rakennus poikkeusViestiBuildissa
          console.log('[HSL A] ' + alerts[i].alertDescriptionText) // Logataan alert konsoliin
          // Tarkistetaan function tila, jos tila on '1' lähetetään viesti(t)
          if (tila === 1) {
            const lahetettyViesti = await bot.sendMessage(config.poikkeusChannelID, lahetettavaViesti, { parse_mode: 'HTML' })
            const msgId = lahetettyViesti.message_id
            poikkeusViestiDb(alerts[i].id, alerts[i].alertDescriptionText, msgId, alertEndDate)
            if (alerts[i].alertSeverityLevel === 'SEVERE') {
              const pinned = await bot.pinChatMessage(config.poikkeusChannelID, msgId)
              console.info('[HSL A Pinned]' + pinned.message_id)
            }
          }
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
    lahetettavaViesti = modes.modeSwitch(mode) + '<b>' + alertsi.alertHeaderText + '</b>\n' + alertsi.alertDescriptionText
  }
  return lahetettavaViesti
}

function poikkeusViestiDb (id, description, msgId, endDate) {
  const insertSQL = 'INSERT INTO poikkeusviestit (alert_id, alert_msg_id, alert_end_date, alert_description) VALUES (?, ?, ?, ?)'
  db.run(insertSQL, [id, msgId, endDate, description], (err) => {
    if (err) {
      console.error(err)
    } else {
      // console.log(`Row inserted with ID ${this.lastID}`)
    }
  })
}

async function poikkeusViestiUpdate (alerts) {
  return new Promise((resolve, reject) => {
    const sqlAllRows = 'SELECT * FROM poikkeusviestit'
    db.all(sqlAllRows, (err, rows) => {
      if (err) {
        console.error(err)
        reject(err)
      } else {
        for (let y = 0; y < rows.length; y += 1) {
          for (let x = 0; x < alerts.length; x += 1) {
            if (rows[y].alert_id === alerts[x].id) {
              // Jos tietokannan ja queryn alertDescription text eroaa
              if (rows[y].alert_description !== alerts[x].alertDescriptionText) {
                // console.log('Not same text, update text')
                console.log('[HSL A update] <' + rows[y].alert_description + '> to <' + alerts[x].alertDescriptionText + '>')
                // Lisää poikkeuksiin tiedot uudesta tekstistä, jotta ei tulis uutta viestiä
                poikkeukset.push(alerts[x].alertDescriptionText)
                // Tekee uuden endDaten
                var alertEndDate = alerts[x].effectiveEndDate
                alertEndDate = Number(alertEndDate) + 3600
                // Rakentaa viestin
                var editoituViesti = poikkeusViestiBuild(alerts[x])
                // Muokkaa viestin
                bot.editMessageText(editoituViesti, { chat_id: config.poikkeusChannelID, message_id: rows[y].alert_msg_id, parse_mode: 'HTML' })
                // Päivittää tekstin tietokantaan
                const sqlUpdateMsg = 'UPDATE poikkeusviestit SET alert_description = ?, alert_end_date = ? WHERE alert_msg_id = ?'
                db.run(sqlUpdateMsg, [alerts[x].alertDescriptionText, alertEndDate, rows[y].alert_msg_id], (err) => {
                  if (err) {
                    console.error(err)
                  }
                })
              } else if (rows[y].alert_end_date !== alerts[x].effectiveEndDate + 3600) {
                console.debug(typeof rows[y].alert_end_date + ' - ' + typeof alerts[x].effectiveEndDate)
                console.debug(rows[y].alert_end_date + ' - ' + alerts[x].effectiveEndDate)
                // Jos tietokannan ja queryn endDate eroaa toisistaan
                console.log('[HSL A update endDate] ' + alerts[x].alertDescriptionText)
                const alertEndDate = Number(alerts[x].effectiveEndDate) + 3600
                const sqlUpdateEnd = 'UPDATE poikkeusviestit SET alert_end_date=? WHERE alert_msg_id=?'
                db.run(sqlUpdateEnd, [alertEndDate, rows[y].alert_msg_id], (err) => {
                  if (err) {
                    console.error(err)
                  }
                })
              }
            }
          }
        }
      }
      resolve()
    })
  })
}

async function poikkeusViestiPoisto () {
  const sqlQuery = 'SELECT * FROM poikkeusviestit WHERE alert_end_date < ?'
  db.all(sqlQuery, moment().unix(), (err, rows) => {
    if (err) {
      return console.error(err)
    }
    if (rows.length !== 0) {
      rows.forEach((row) => {
        bot.deleteMessage(config.poikkeusChannelID, row.alert_msg_id).then(re => {
          const removeSQL = 'DELETE FROM poikkeusviestit WHERE alert_msg_id = ?'
          db.run(removeSQL, row.alert_msg_id, (err) => {
            if (err) {
              console.error(err)
            } else {
              console.log('[HSL A del] ' + row.alert_description)
            }
          })
        }).catch(err => {
          console.error('TELEGRAM: ' + err.response.body.error_code + ' ' + err.response.body.description)
          if (err.response.body.description === 'Bad Request: message to delete not found' && err.response.body.error_code === 400) {
            console.log('[HSL A del] Message "' + row.alert_description + '" cannot be found, deleting from database')
            const removeSQL = 'DELETE FROM poikkeusviestit WHERE alert_msg_id = ?'
            db.run(removeSQL, row.alert_msg_id, (err) => {
              if (err) {
                console.error(err)
              } else {
                console.log('[HSL A del] Row deleted successfully')
              }
            })
          }
        })
      })
    }
  })
}

module.exports = {
  tarkistaPoikkeukset,
  poikkeusViestiPoisto
}
