FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN apk add --no-cache postgresql-client python3 make g++ && npm ci

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start:prod"]