FROM node:14

WORKDIR /usr/src/app

# Prepare environment
ENV CONFIG_CREDS_SETTINGS=/root/creds.json
ENV CONFIG_POW_CREDS_SETTINGS=/root/pow_creds.json
ENV CONFIG_REQUEST_STAT=/root/request-stat.json
ENV CONFIG_SETTINGS=/root/settings.json
ENV CONFIG_TOKEN_SETTINGS=/root/token_settings.json
ENV CONFIG_USER_SETTINGS=/root/user_settings.json
ENV CONFIG_WEBSOCKET_PATH=/root/websocket.json
COPY ./package*.json ./
COPY ./tsconfig.json ./
RUN npm install

# Copy source files
COPY ./src ./src

# Typescript → Javascript
RUN npm run-script build

VOLUME /root

EXPOSE 9950

CMD [ "node", "dist/proxy.js" ]
