module.exports = {
    // Modules
    enablePerutut: true,
    enablePoikkeukset: true,
    enableDebug: false,
    // API
    digitransitAPILink: 'http://api.digitransit.fi/routing/v1/routers/hsl/index/graphql?digitransit-subscription-key=' + process.env.digitransitApiKey,
    // Telegram channels
    poikkeusChannelID: -1001727635029,
}