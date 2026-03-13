FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/

RUN npm install --ignore-scripts

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
