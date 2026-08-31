FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Modo de ejecución: "daemon" (monitoreo de commits, default) o "server" (REST).
ENV MICO_MODE=daemon
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["sh", "-c", "if [ \"$MICO_MODE\" = \"server\" ]; then exec node dist/cli.js serve; else exec node dist/cli.js start; fi"]