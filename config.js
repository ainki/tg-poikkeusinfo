module.exports = {
  enablePerutut: true,
  enablePoikkeukset: true,
  enablePolling: false,
  enableDebug: true,
  digitransitAPILink: `https://api.digitransit.fi/routing/v2/hsl/gtfs/v1?digitransit-subscription-key=${process.env.digitransitApiKey}`,
  poikkeusChannelID: process.env.channelId
};