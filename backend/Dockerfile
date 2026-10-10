FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY index.js ./

USER node
EXPOSE 3001

HEALTHCHECK CMD wget -q -O /dev/null http://localhost:3001/health || exit 1

CMD ["node", "index.js"]
