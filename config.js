module.exports = {
  // Modules
  enablePerutut: true, // Perutut vuorot päälle/pois
  enablePoikkeukset: true, // Poikkeusinfo päälle/pois
  enablePolling: false, // Polling päälle/pois
  enableDebug: true,
  // API
  digitransitAPILink: 'https://api.digitransit.fi/routing/v1/routers/hsl/index/graphql?digitransit-subscription-key=' + process.env.digitransitApiKey,
  // Telegram channels
  poikkeusChannelID: process.env.channelId
}
