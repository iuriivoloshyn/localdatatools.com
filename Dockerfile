FROM node:22-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim
RUN npm install -g serve
WORKDIR /app
COPY --from=builder /app/dist ./dist
ENV PORT=8080
EXPOSE 8080
# No "-s": the SEO prerender emits a real HTML file per route (dist/<slug>/index.html),
# and `serve -s` would rewrite every path to home, defeating the per-route canonicals.
CMD ["serve", "dist", "-l", "8080"]
