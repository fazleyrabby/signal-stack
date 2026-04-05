FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN apk add --no-cache postgresql-client && npm ci

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["node", "dist/src/main.js"]