FROM node:20

WORKDIR /app

# Install all dependencies (including dev for the build process)
COPY package.json package-lock.json* ./
RUN npm ci --no-audit || npm install --no-audit

# Copy everything else
COPY . .

# Build application
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Expose port and start
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
ENV NODE_OPTIONS="--max-old-space-size=300 --expose-gc"
CMD ["npm", "start"]
