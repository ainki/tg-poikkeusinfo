// HSL perutut vuorot

// Import
const bot = require('../bot');
const config = require('../config');
// npm
const { request } = require('graphql-request')
var moment = require('moment');
var loki = require('lokijs');
moment.locale('fi-FI');

// Database
var peruttuViestit
var db = new loki('./data/perutut.db',
    {
        autoload: true,
        autosave: true,
        autosaveInterval: 30000,
        autoloadCallback: databaseInitialize,
    }
);

// implement the autoloadback referenced in loki constructor
async function databaseInitialize() {
    console.log('Ladataan tietokanta...')
    peruttuViestit = db.getCollection("perututuViestit");
    if (peruttuViestit === null) {
        peruttuViestit = db.addCollection("perututuViestit");
    }

    console.log(peruttuViestit.data)

    // kick off any program logic or start listening to external events
    tarkistaPerutut();
}
// var peruttuViestit = db.addCollection('perututuViestit');
let listaPerutuista = [];


// Lataa tietokanta käynnistyksen yhteydessä
// db.loadDatabase({}, function () {
//     peruttuViestit = db.loadCollection('perututuViestit');
//     console.info('Tietokanta ladattu');
//     console.log(peruttuViestit.data)
// });


// Poikkeusten hakufunktio
async function tarkistaPerutut(tila) {
    //graphQL hakulause
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

    return request(config.digitransitAPILink, query)
        .then(function (data) {
            // const data = await request(channels.digitransitAPILink, query);
            let perututVuorot = data.cancelledTripTimes;
            // Käy läpi jokaisen perutun vuoron
            for (i = 0; i < perututVuorot.length; i += 1) {
                // Tarkistaa onko peruttu vuoro jo olemassa
                if (listaPerutuista.indexOf(perututVuorot[i].trip.id) === -1) {
                    // var tripId = perututVuorot[i].trip.id;
                    // Lisää uuden perutun peruttuihin, jotta se ei toistu 
                    listaPerutuista.push(perututVuorot[i].trip.id);
                    // Ajan käsittely
                    var departureTimeNum = Number(perututVuorot[i].scheduledDeparture);
                    var serviceDayNum = Number(perututVuorot[i].serviceDay);

                    // var alertEndDate = departureTimeNum + 10800 + moment().unix();
                    // var alertEndDate = departureTimeNum + 10800 + serviceDayNum;
                    var alertEndDate = departureTimeNum + 180 + serviceDayNum;
                    // Viesti
                    var lahetettavaViesti;
                    // Moment
                    // var tanaan = moment().format('L');
                    // console.debug(' ')
                    // console.debug('Tänään on: ' + moment().format('L'))
                    // console.debug(departureTimeNum)
                    // console.debug(Number(perututVuorot[i].serviceDay))
                    // console.debug( "Yhdistetty kello: " + moment.unix(Number(perututVuorot[i].serviceDay) + departureTimeNum).format('LLL'));


                    if (moment.unix(Number(perututVuorot[i].serviceDay) + departureTimeNum).format('L') == moment().format('L')) {
                        lahetettavaViesti = perututVuorot[i].trip.routeShortName + ' ' + perututVuorot[i].trip.tripHeadsign + ' klo ' + moment.unix(Number(perututVuorot[i].serviceDay) + departureTimeNum).format('HH:mm') + ' on peruttu';
                    } else {
                        lahetettavaViesti = perututVuorot[i].trip.routeShortName + ' ' + perututVuorot[i].trip.tripHeadsign + ' ' + moment.unix(Number(perututVuorot[i].serviceDay) + departureTimeNum).format('L') + ' klo ' + moment.unix(Number(perututVuorot[i].serviceDay) + departureTimeNum).format('HH:mm') + ' on peruttu';
                    }
                    // Lisää viestin alkuun merkin jos kulkuneivo tiedossa
                    var mode = perututVuorot[i].trip.pattern.route.mode;
                    if (perututVuorot[i].trip.pattern.route.mode) {
                        switch (mode) {
                            case "BUS": lahetettavaViesti = "Ⓑ " + lahetettavaViesti;
                                break;
                            case "SUBWAY": lahetettavaViesti = "Ⓜ " + lahetettavaViesti;
                                break;
                            case "TRAM": lahetettavaViesti = "Ⓡ " + lahetettavaViesti;
                                break;
                            case "RAIL": lahetettavaViesti = "Ⓙ " + lahetettavaViesti;
                                break;
                            case "FERRY": lahetettavaViesti = "Ⓛ " + lahetettavaViesti;
                                break;
                            default:
                                lahetettavaViesti = lahetettavaViesti;
                                break;
                        }
                    }
                    console.log('[HSL Peruttu] ' + lahetettavaViesti); // Logataan alert konsoliin

                    // Tarkistetaan onko ensimmäinen haku, vaikuttaa viestien lähettämiseen
                    if (tila == 1) {
                        bot.sendMessage(config.poikkeusChannelID, lahetettavaViesti).then(re => {
                            perututVuorotViestiLista(perututVuorot[i].trip.id, re.message_id, Number(perututVuorot[i].scheduledDeparture) + Number(perututVuorot[i].serviceDay) + 180, lahetettavaViesti);
                        }).catch(err => {
                            console.error(err);
                        })
                    }

                }
            }
        })
        .catch(function (error) {
            console.error(error);
        });
}

function perututVuorotViestiLista(tripId, msgId, effectiveEndDate, messageBody) {
    peruttuViestit.insert({
        cancelTripId: tripId,
        cancelMsgId: msgId,
        cancelEndDate: effectiveEndDate,
        cancelMessage: messageBody
    });
    db.saveDatabase();
}

async function perututViestiPoisto() {
    // console.debug('[HSL Peruttu] Tarkistetaan poistettavia peruttu viestejä');
    // Hakee tietokannasta viestit jotka on vanhempia kuin 3 tuntia
    var poistettavatViestit = peruttuViestit.chain()
        .find({ cancelEndDate: { $lt: moment().unix() } })
        .data();

    for (i = 0; i < poistettavatViestit.length; i += 1) {
        var viestiID = poistettavatViestit[i].cancelMsgId;
        // console.log("Poistetaan viesti ID: " + viestiID);
        peruttuViestit.chain().find({ cancelMsgId: viestiID }).remove();
        db.saveDatabase();
        // console.log('Viesti poistettu tietokannasta');
        bot.deleteMessage(config.poikkeusChannelID, viestiID).then(re => {
            console.debug("Poistettu viesti: " + viestiID);
        }).catch(err => {
            console.error(err);
            if (err.response.body.error_code == 400) {
                console.debug('Viestiä ei löytynyt, poistetaan tietokannasta');
                peruttuViestit.chain().find({ cancelMsgId: viestiID }).remove();
                db.saveDatabase();
            }
        })
    }
    console.debug('Tietokanta poiston jälkeen: ')
    console.debug(peruttuViestit.data)
}


module.exports = {
    tarkistaPerutut,
    perututViestiPoisto,
    databaseInitialize
}