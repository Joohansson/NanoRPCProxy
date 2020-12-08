FROM node:14

WORKDIR /usr/src/app
RUN chown node:node .
USER node

# Prepare environment
COPY ./server/package*.json ./
RUN npm install

# Copy source files
COPY server/* ./

EXPOSE 9950

CMD [ "node", "proxy.js" ]
