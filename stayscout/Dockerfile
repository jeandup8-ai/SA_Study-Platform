# Single container: API + built client. Works on Render, Fly.io, Railway, Cloud Run.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx vite build && npx tsc -p tsconfig.server.json

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
EXPOSE 8787
USER node
CMD ["node", "dist-server/server/main.js"]
