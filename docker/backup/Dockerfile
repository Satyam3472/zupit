# ==============================================================================
# Zupit Production PostgreSQL Backup Container (Alpine 3.20 + Postgres 16 client + rclone)
# ==============================================================================
FROM alpine:3.20.3

RUN apk add --no-cache \
    postgresql16-client \
    rclone \
    gzip \
    bash \
    tzdata \
    ca-certificates \
    curl

# Configure Indian Standard Time (IST)
ENV TZ=Asia/Kolkata
RUN cp /usr/share/zoneinfo/Asia/Kolkata /etc/localtime && echo "Asia/Kolkata" > /etc/timezone

WORKDIR /scripts
COPY backup.sh /scripts/backup.sh
COPY entrypoint.sh /scripts/entrypoint.sh
RUN chmod +x /scripts/backup.sh /scripts/entrypoint.sh

VOLUME ["/backups"]

ENTRYPOINT ["/scripts/entrypoint.sh"]
