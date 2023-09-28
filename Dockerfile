FROM node:18.16.0-alpine

ARG token
ENV token=${token}
ARG TZ
ENV TZ=${TZ}
ARG digitransitApiKey
ENV digitransitApiKey=${digitransitApiKey}
ARG channelId
ENV channelId=${channelId}

WORKDIR /app
COPY . ./

RUN npm install

CMD ["npm", "start"]