# tg-poikkeusinfo

Telegram botti, joka lähettää Helsingin seudun liikenteen ajankohtaiset liikennehäiriöt ja -tiedotteet, sekä perutut vuorot Telegram-kanavalle. Sovellus poistaa poikkeukset kolme tuntia rajapinnan mukaaisen loppumisajan jälkeen, ja perutut vuorot kaksi tuntia vuoron aikataulun mukaisen lähtöajan jälkeen.

### Kanava
[Klikkaa tästä niin pääset kanavalle.](http://t.me/hslpoikkeusinfo)

## Käyttö

### Env

+ `token` Telegram bot token
+ `TZ` Aikavyöhyke (HSL käytössä käytä `Europe/Helsinki`)
+ `digitransitApiKey` Digitransit API avain. Lisätietoa [digitransit.fi](https://digitransit.fi)
+ `channelId` Telegram kanavan ID