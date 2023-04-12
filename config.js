module.exports = {
  // Modules
  enablePerutut: true, // Perutut vuorot päälle/pois
  enablePoikkeukset: true, // Poikkeusinfo päälle/pois
  enableDebug: false, // Polling päälle/pois
  // API
  digitransitAPILink: 'http://api.digitransit.fi/routing/v1/routers/hsl/index/graphql?digitransit-subscription-key=' + process.env.digitransitApiKey,
  // Telegram channels
  poikkeusChannelID: process.env.channelId
}
