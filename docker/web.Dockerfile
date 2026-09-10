FROM node:22-alpine AS dependencies
RUN npm install --global npm@11.19.1
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci

FROM dependencies AS build
COPY apps/web apps/web
RUN npm run build --workspace=@pastagansa/web

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/apps/web/package.json apps/web/package.json
COPY --from=build /app/apps/web/.next apps/web/.next
COPY --from=build /app/node_modules node_modules
USER node
EXPOSE 3001
CMD ["./node_modules/.bin/next", "start", "apps/web", "-p", "3001"]
