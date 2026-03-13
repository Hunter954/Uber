FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/

RUN npm install --workspaces --include-workspace-root=false

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
