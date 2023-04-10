// HSL Poikkeukset

// 
const bot = require('../bot');
const channels = require('../config');
// paketit
var loki = require('lokijs')
const { request } = require('graphql-request')
var moment = require('moment');
moment.locale('fi-FI');
// 
let poikkeukset = [];
// let poikkeusViestit = [];
const parseMode = 'html'
//
var db = new loki('poikkeukset.db');
var poikkeusViestit = db.addCollection('poikkeusViestit');

// Hae poikeukset
async function tarkistaPoikkeukset(tila) {
    //graphQL hakulause
    const query = `{
            alerts {
                alertHeaderText
                alertDescriptionText
                alertSeverityLevel
                effectiveStartDate
                effectiveEndDate
                route {
                mode
                }
                }
            }`

    return request(channels.digitransitAPILink, query)
        .catch(err => {
            console.log(err)
        })
        .then(function (data) {
            let alerts = data.alerts;
            poikkeusViestiPoisto(data);
            // Menee jokaisen poikkeuksen läpi
            for (i = 0; i < alerts.length; i += 1) {
                // Tarkistaa onko poikkeus jo olemassa
                if (poikkeukset.indexOf(alerts[i].alertDescriptionText) === -1) {
                    // Lisää uuden alertin poikkeuksiin, jotta se ei toistu 
                    poikkeukset.push(alerts[i].alertDescriptionText);

                    var lahetettavaViesti;
                    var alertDescription = alerts[i].alertDescriptionText // Poikkeuksen kuvaus
                    var alertSeverity = alerts[i].alertSeverityLevel // Poikkeuksen tärkeys
                    var alertEndDate = alerts[i].effectiveEndDate // Poikkeuksen effectiveEndDate

                    // Tarkastaa onko poikkeuksella kulkuneuvo ja rakentaa viestin
                    if (!alerts[i].route) {
                        lahetettavaViesti = "<b>" + alerts[i].alertHeaderText + "</b>\n" + alerts[i].alertDescriptionText
                    } else {
                        var mode = alerts[i].route.mode;
                        // Lisää viestin alkuun merkin
                        switch (mode) {
                            case "BUS": lahetettavaViesti = "Ⓑ <b>" + alerts[i].alertHeaderText + "</b>\n" + alerts[i].alertDescriptionText;
                                break;
                            case "SUBWAY": lahetettavaViesti = "Ⓜ <b>" + alerts[i].alertHeaderText + "</b>\n" + alerts[i].alertDescriptionText;
                                break;
                            case "TRAM": lahetettavaViesti = "Ⓡ <b>" + alerts[i].alertHeaderText + "</b>\n" + alerts[i].alertDescriptionText;
                                break;
                            case "RAIL": lahetettavaViesti = "Ⓙ <b>" + alerts[i].alertHeaderText + "</b>\n" + alerts[i].alertDescriptionText;
                                break;
                            case "FERRY": lahetettavaViesti = "Ⓛ <b>" + alerts[i].alertHeaderText + "</b>\n" + alerts[i].alertDescriptionText;
                                break;
                            default:
                                lahetettavaViesti = "<b>" + alerts[i].alertHeaderText + "</b>\n" + alerts[i].alertDescriptionText;
                                break;
                        }
                    }
                    // Logataan poikkeus konsoliin
                    console.log('[HSL Alert] ' + alertDescription) // Logataan alert konsoliin
                    // Tarkistetaan function tila, jos tila on "1" lähetetään viesti(t)
                    if (tila == 1) {
                        bot.sendMessage(channels.poikkeusChannelID, lahetettavaViesti, { parseMode }).then(re => {
                            poikkeusViestiListaus(alertDescription, re.message_id, alertEndDate);
                            if (alertSeverity === "SEVERE") {
                                bot.pinChatMessage(channels.poikkeusChannelID, re.message_id)
                            }
                        }).catch(err => {
                            console.error(err);
                        })
                    }
                }
            }
        })
}

function poikkeusViestiListaus(alertDescription, message_id, alertEndDate) {
    poikkeusViestit.insert({
        alertDescription: alertDescription,
        message_id: message_id,
        alertEndDate: alertEndDate
    })
    db.saveDatabase();
}

async function poikkeusViestiPoisto() {
    // console.debug('[HSL Alert] Tarkistetaan poistettavia poikkeusviestejä');

    var poistettavatViestit = poikkeusViestit.chain()
        .find({ cancelEndDate: { $lt: moment().unix() } })
        .data();
        // .remove(); // Poistetaan myös tietokannasta
    // console.debug(poistettavatViestit);

    // Käydää jokainen poistettava läpi ja poistetaan viesti

    for (i = 0; i < poistettavatViestit.length; i += 1) {
        var poistettavaViesti = poistettavatViestit[i].message_id;
        var poistettavaAlertDescription = poistettavatViestit[i].cancelTripId;
        console.debug("Poistettava viesti: " + poistettavaViesti);
        // console.debug("Poistettava tripId: " + poistettavaAlertDescription);
        bot.deleteMessage(channels.poikkeusChannelID, poistettavaViesti).then(re => {
            console.debug("Poistettu viesti: " + poistettavaViesti);
            poikkeusViestit.chain().find({ message_id: poistettavaViesti }).remove();
        }).catch(err => {
            console.error(err);
        })
    }
}

module.exports = {
    tarkistaPoikkeukset
}