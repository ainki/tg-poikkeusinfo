// HSL Poikkeukset

const bot = require('../bot')
const config = require('../config')
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
      console.log('[HSL A] ' + alertDescription) // Logataan alert konsoliin
      // Tarkistetaan function tila, jos tila on '1' lähetetään viesti(t)
      if (tila === 1) {
        const lahetettyViesti = await bot.sendMessage(config.poikkeusChannelID, lahetettavaViesti, { parse_mode: 'HTML' })
        const msgId = lahetettyViesti.message_id
        poikkeusViestiDb(alertId, alertDescription, msgId, alertEndDate)
        if (alertSeverity === 'SEVERE') {
          const pinned = await bot.pinChatMessage(config.poikkeusChannelID, msgId)
          console.info('[HSL A Pinned]' + pinned.message_id)
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

// Alertin päivitys
async function poikkeusViestiUpdate (alerts) {
  // var kaikkiPoikkeusViestit = poikkeusViestit.chain().data()
  const sqlAllRows = 'SELECT * FROM poikkeusviestit'
  db.all(sqlAllRows, (err, rows) => {
    if (err) {
      return console.error(err)
    }
    for (let y = 0; y < rows.length; y += 1) {
      for (let x = 0; x < alerts.length; x += 1) {
        if (rows[y].alertId === alerts[x].id) {
          // Jos tietokannan ja queryn alertDescription text eroaa
          if (rows[y].alertDescription !== alerts[x].alertDescriptionText) {
            // console.log('Not same text, update text')
            console.log('[HSL A update] <' + rows[y].alertDescription + '> to <' + alerts[x].alertDescriptionText + '>')
            // Lisää poikkeuksiin tiedot uudesta tekstistä, jotta ei tulis uutta viestiä
            poikkeukset.push(alerts[x].alertDescriptionText)
            // Tekee uuden endDaten
            var alertEndDate = alerts[x].effectiveEndDate
            alertEndDate = Number(alertEndDate) + 10800
            // Rakentaa viestin
            var editoituViesti = poikkeusViestiBuild(alerts[x])
            // Muokkaa viestin
            bot.editMessageText(editoituViesti, { chat_id: config.poikkeusChannelID, message_id: rows[y].alertMessageId, parse_mode: 'HTML' })
            // Päivittää tekstin tietokantaan
            const sqlUpdateMsg = 'UPDATE poikkeusviestit SET alert_description = ? AND alert_end_date = ? WHERE alert_msg_id = ?'
            db.run(sqlUpdateMsg, [alerts[x].alertDescriptionText, alertEndDate, rows[y].alertMessageId], (err) => {
              if (err) {
                console.error(err)
              }
            })
          } else if (rows[y].alertEndDate !== Number(alerts[x].effectiveEndDate)) {
            // Jos tietokannan ja queryn endDate eroaa toisistaan
            console.log('[HSL A update end] ' + alerts[x].alertDescriptionText)
            const alertEndDate = Number(alerts[x].effectiveEndDate) + 10800
            const sqlUpdateEnd = 'UPDATE poikkeusviestit SET alert_end_date = ? WHERE alert_msg_id = ?'
            db.run(sqlUpdateEnd, [alertEndDate, rows[y].alertMessageId], (err) => {
              if (err) {
                console.error(err)
              }
            })
          }
        }
      }
    }
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
          const removeSQL = 'DELETE FROM perututvuorot WHERE alert_msg_id = ?'
          db.run(removeSQL, row.alert_msg_id, (err) => {
            if (err) {
              console.error(err)
            }
          })
        }).catch(err => {
          console.error('TELEGRAM ERROR' + err.response.body.error_code + ' ' + err.response.body.description)
          if (err.response.body.description === 'Bad Request: message to delete not found' && err.response.body.error_code === 400) {
            console.log('[HSL A delete] Message cannot be found, deleting from database')
            const removeSQL = 'DELETE FROM perututvuorot WHERE alert_msg_id = ?'
            db.run(removeSQL, row.alert_msg_id, (err) => {
              if (err) {
                console.error(err)
              }
            })
          }
        })
      })
    }
  })
}

tarkistaPoikkeukset()

module.exports = {
  tarkistaPoikkeukset,
  poikkeusViestiPoisto
}
