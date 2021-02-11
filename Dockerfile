FROM node:14

WORKDIR /usr/src/app
RUN chown node:node .
USER node

# Prepare environment
COPY ./package*.json ./
COPY ./tsconfig.json ./
RUN npm install

# Copy source files
COPY ./src ./src

# Typescript → Javascript
RUN npm run-script build

EXPOSE 9950

CMD [ "node", "dist/proxy.js" ]
