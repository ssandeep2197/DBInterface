### --- build stage --------------------------------------------------------- ###
FROM node:20-alpine AS build
WORKDIR /workspace

COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

COPY tsconfig.base.json nx.json ./
COPY apps/web ./apps/web
COPY libs/shared ./libs/shared

ARG VITE_API_URL=/
ENV VITE_API_URL=$VITE_API_URL
RUN npx vite build --config apps/web/vite.config.mts

### --- runtime stage (nginx) ---------------------------------------------- ###
FROM nginx:1.27-alpine AS runtime
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/dist/apps/web /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost/ >/dev/null || exit 1
