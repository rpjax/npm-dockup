FROM alpine:3.20
RUN apk add --no-cache curl
HEALTHCHECK CMD curl -f http://localhost:8080/health || exit 1
CMD ["sleep", "infinity"]
