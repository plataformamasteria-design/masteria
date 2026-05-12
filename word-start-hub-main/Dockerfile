FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html

# SPA fallback config with port 80 as default
RUN printf 'server {\n\
  listen 80;\n\
  server_name _;\n\
  root /usr/share/nginx/html;\n\
  index index.html;\n\
  location / {\n\
  try_files $uri $uri/ /index.html;\n\
  }\n\
  }\n' > /etc/nginx/conf.d/default.conf

# At startup, replace port 80 with $PORT if defined, then start nginx
CMD sh -c "if [ -n \"$PORT\" ]; then sed -i \"s/listen 80/listen $PORT/\" /etc/nginx/conf.d/default.conf; fi && nginx -g 'daemon off;'"
