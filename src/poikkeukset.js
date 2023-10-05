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
  // Päivitetään ennen uusia
  try {
    await alertViestiUpdate(alerts)
  } catch (error) {
    console.error(error)
  }
  newAlert(alerts, tila)
}

async function newAlert (alerts, tila) {
  for (let i = 0; i < alerts.length; i += 1) { // Menee jokaisen poikkeuksen läpi
    if (alerts[i].effectiveStartDate < moment().unix()) { // Tarkistaa poikkeuksen vaikutausaikan
      if (!(alerts[i].alertSeverityLevel === 'INFO' && alerts[i].alertEffect === 'NO_EFFECT')) { // Filteröidään info ja no effect pois
        if (!(poikkeukset.some(item => item.id === alerts[i].id) || poikkeukset.some(item => item.desc === alerts[i].alertDescriptionText))) { // Tarkistaa onko poikkeus jo olemassa
          const sameDescAlerts = alerts.filter(item => item.alertDescriptionText === alerts[i].alertDescriptionText)
          // Lisää uudet poikkeukset poikkeuksiin, jotta se ei toistu (samalla descriptionilla saattaa olla monia alertteja koska jokainen linja jota vaikuttaa on oma id)
          sameDescAlerts.forEach((row) => {
            const poikkeus = { id: row.id, desc: row.alertDescriptionText }
            poikkeukset.push(poikkeus)
          })
          console.log('[HSL A] ' + alerts[i].alertDescriptionText) // Logataan alert konsoliin
          if (tila === 1) {
            const alertEnd = alerts[i].effectiveEndDate + 3600
            const viesti = alertMessageBuild(alerts[i], sameDescAlerts)
            const sentViesti = await bot.sendMessage(config.poikkeusChannelID, viesti, { parse_mode: 'HTML' })
            const viestiId = sentViesti.message_id
            poikkeusViestiDb(alerts[i].id, alerts[i].alertDescriptionText, viestiId, alertEnd)
            if (alerts[i].alertSeverityLevel === 'SEVERE') {
              const pinned = await bot.pinChatMessage(config.poikkeusChannelID, viestiId)
              console.info('[HSL A Pinned]' + pinned.message_id)
            }
          }
        }
      }
    }
  }
}

async function alertViestiUpdate (alerts) {
  return new Promise((resolve, reject) => {
    const sqlAllRows = 'SELECT * FROM poikkeusviestit'
    db.all(sqlAllRows, (err, rows) => {
      if (err) {
        reject(err)
      } else {
        rows.forEach((row) => {
          const sameIdAlert = alerts.filter(item => item.id === row.alert_id)
          if (sameIdAlert[0]) {
            if (!(sameIdAlert[0].alertDescriptionText === row.alert_description)) {
              // Jos alert description on muuttunut
              console.log('[HSL A update] Msg: ' + row.alert_msg_id + ' to ' + sameIdAlert[0].alertDescriptionText)
              const alertEnd = sameIdAlert[0].effectiveEndDate + 3600
              const sameDescAlerts = alerts.filter(item => item.alertDescriptionText === sameIdAlert[0].alertDescriptionText)
              const viesti = alertMessageBuild(sameIdAlert[0], sameDescAlerts)
              // Muokkaa viestin
              bot.editMessageText(viesti, { chat_id: config.poikkeusChannelID, message_id: row.alert_msg_id, parse_mode: 'HTML' })
              // Päivitetään tietokantaan description ja end date
              const sqlUpdateMsg = 'UPDATE poikkeusviestit SET alert_description=?, alert_end_date=? WHERE alert_msg_id=?'
              db.run(sqlUpdateMsg, [sameIdAlert[0].alertDescriptionText, alertEnd, row.alert_msg_id], function (err) {
                if (err) {
                  reject(err)
                }
              })
            } else if (!(sameIdAlert[0].effectiveEndDate + 3600 === row.alert_end_date)) {
              // Jos pelkkä end date muuttunut
              console.log('[HSL A update] Msg: ' + row.alert_msg_id + ' alertEnd changed!')
              const alertEnd = sameIdAlert[0].effectiveEndDate + 3600
              const sqlUpdateEnd = 'UPDATE poikkeusviestit SET alert_end_date=? WHERE alert_msg_id=?'
              db.run(sqlUpdateEnd, [alertEnd, row.alert_msg_id], (err) => {
                if (err) {
                  reject(err)
                }
              })
            }
          } else {
            // Jos alerttia ei löydy querystä, poistetaan alertti
            console.log('[HSL A update] deleting: ' + row.alert_description)
            bot.deleteMessage(config.poikkeusChannelID, row.alert_msg_id).then(re => {
              const removeSQL = 'DELETE FROM poikkeusviestit WHERE alert_msg_id = ?'
              db.run(removeSQL, [row.alert_msg_id], (err) => {
                if (err) {
                  reject(err)
                }
              })
            })
          }
        })
      }
    })
    resolve()
  })
}

// Viestin rakennus
function alertMessageBuild (alertsi, sameDescAlerts) {
  const allModesForAlert = [...new Set(sameDescAlerts.map(item => item.route && item.route.mode).filter(Boolean))]
  let alertModes = ''
  if (allModesForAlert) {
    allModesForAlert.forEach((row) => {
      alertModes = alertModes + modes.modeSwitch(row)
    })
  }
  const viesti = alertModes + '<b>' + alertsi.alertHeaderText + '</b>\n' + alertsi.alertDescriptionText
  return viesti
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
