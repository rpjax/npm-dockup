FROM node:22-alpine
WORKDIR /app
COPY . .
CMD ["node", "-e", "require('http').createServer((q,s)=>s.end('api')).listen(8080)"]
