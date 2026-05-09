### --- build stage --------------------------------------------------------- ###
FROM node:24-alpine AS build
WORKDIR /workspace

COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

COPY tsconfig.base.json nx.json ./
COPY apps/api ./apps/api
COPY libs/shared ./libs/shared

# tsc emits ESM-style require('@dbi/shared') unchanged; tsc-alias rewrites those
# to relative paths so Node can resolve them without the workspace symlinks.
RUN npx tsc -p apps/api/tsconfig.app.json \
 && npx tsc-alias -p apps/api/tsconfig.app.json

### --- runtime stage ------------------------------------------------------- ###
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

COPY --from=build /workspace/dist ./dist

USER node
EXPOSE 8082
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "fetch('http://localhost:8082/health').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"
CMD ["node", "dist/apps/api/apps/api/src/main.js"]
