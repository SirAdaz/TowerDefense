# Tower defense : site statique (Vite + TypeScript + Canvas).
# - `dev`   : Node, serveur Vite (docker-compose.yml, service `app`).
# - `build` : `npm run build` -> dist/.
# - `prod`  : nginx qui sert dist/, aucun Node en production.
FROM node:24.22.3-alpine AS dev
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
EXPOSE 5180
CMD ["npm", "run", "dev"]

FROM dev AS build
RUN npm run build

FROM nginx:1.30.4-alpine AS prod
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
