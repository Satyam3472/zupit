# ==============================================================================
# Zupit MinIO S3-Compatible Storage (Pinned Release on Alpine 3.20)
# ==============================================================================
FROM alpine:3.20.3

RUN apk add --no-cache curl ca-certificates && \
    curl -sSL -o /usr/local/bin/minio https://github.com/minio/minio/releases/download/RELEASE.2025-09-07T16-13-09Z/minio.linux-amd64.RELEASE.2025-09-07T16-13-09Z && \
    chmod +x /usr/local/bin/minio && \
    mkdir -p /data

VOLUME ["/data"]

EXPOSE 9000 9001

ENTRYPOINT ["/usr/local/bin/minio"]
