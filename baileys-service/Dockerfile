FROM node:20-alpine

WORKDIR /app

# Install dependencies first (cache layer)
COPY package.json package-lock.json* ./
RUN npm ci --production=false

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Production
ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "dist/index.js"]
