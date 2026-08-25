FROM node:22-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm install
RUN npx playwright install --with-deps chromium

COPY . .
RUN npx prisma generate
RUN npm run build

ENV NODE_ENV=production
ENV SCREENSHOT_DIR=/data/screenshots

RUN mkdir -p /data/screenshots

CMD ["npm", "start"]
