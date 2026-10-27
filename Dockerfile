FROM node:24-bookworm-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
ARG BASE_PATH=/
ARG VITE_COURSE_DEMO_MODE=true
ENV VITE_COURSE_DEMO_MODE=${VITE_COURSE_DEMO_MODE}
RUN npm run build -- --base="${BASE_PATH}"

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV PORT=3000
ENV COURSE_DEMO_MODE=true
ENV FRONTEND_DIST=/app/frontend/dist
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --chown=node:node backend/src ./src
COPY --chown=node:node backend/database ./database
COPY --from=frontend-build --chown=node:node /app/frontend/dist /app/frontend/dist
USER 1000:1000
EXPOSE 3000
CMD ["node", "src/server.js"]