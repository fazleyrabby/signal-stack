# Use Node.js 20 base image
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
# We need to provide the public API URL during build time for Next.js to embed it if needed
# In a real setup, you might want to use relative paths if on same domain
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build

# Production image
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app ./

EXPOSE 3001

# Next.js starts on 3000 by default, let's force 3001
ENV PORT=3001
CMD ["npm", "start"]
