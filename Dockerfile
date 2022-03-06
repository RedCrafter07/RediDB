FROM node:17.6.0

WORKDIR /app

COPY package*.json ./

RUN npm install

RUN npm install -g typescript

COPY . .

RUN tsc

CMD [ "npm", "run", "start" ]

