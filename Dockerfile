FROM node:18.18.0-alpine

ARG token
ENV token=${token}
ARG TZ
ENV TZ=${TZ}
ARG digitransitApiKey
ENV digitransitApiKey=${digitransitApiKey}
ARG channelId
ENV channelId=${channelId}
ARG dataPath
ENV dataPath=${dataPath}

WORKDIR /app
COPY . ./

RUN npm install

CMD ["npm", "start"]