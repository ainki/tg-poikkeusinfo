FROM node:24.15.0-alpine

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

RUN corepack enable

RUN pnpm install --recursive

CMD ["pnpm", "start"]