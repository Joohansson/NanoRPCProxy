FROM node:14

WORKDIR /usr/src/app
RUN mkdir dist
RUN chown -R node:node .
USER node

# Prepare environment
COPY ./server/package*.json ./
COPY ./server/tsconfig.json ./
RUN npm install

# Copy source files
COPY ./server/src ./src
RUN npm run-script build

EXPOSE 9950

CMD [ "node", "dist/proxy.js" ]
