FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY db ./db

EXPOSE 3000
CMD ["node", "src/index.js"]
