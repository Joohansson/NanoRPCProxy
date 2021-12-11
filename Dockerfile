# Build stage #
FROM node:14

WORKDIR /usr/src/app

# Prepare environment
COPY ./package*.json ./
COPY ./tsconfig.json ./
RUN npm ci

# Copy source files
COPY ./src ./src

# Typescript → Javascript
RUN npm run-script build

# Deploy stage #
FROM node:14

WORKDIR /app

# Setup environment variables for docker
ENV CONFIG_CREDS_SETTINGS=/root/creds.json
ENV CONFIG_POW_CREDS_SETTINGS=/root/pow_creds.json
ENV CONFIG_REQUEST_STAT=/root/request-stat.json
ENV CONFIG_SETTINGS=/root/settings.json
ENV CONFIG_TOKEN_SETTINGS=/root/token_settings.json
ENV CONFIG_USER_SETTINGS=/root/user_settings.json
ENV CONFIG_WEBSOCKET_PATH=/root/websocket.json

# Install dependencies
COPY ./package*.json ./
RUN npm ci --production

# Copy build files from stage 0
COPY --from=0 /usr/src/app/dist ./dist

VOLUME /root

EXPOSE 9950

CMD [ "node", "dist/proxy.js" ]
