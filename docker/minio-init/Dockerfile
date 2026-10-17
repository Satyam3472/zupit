# ==============================================================================
# Zupit MinIO Client (mc) One-off Initializer (Pinned Release on Alpine 3.20)
# ==============================================================================
FROM alpine:3.20.3

RUN apk add --no-cache curl ca-certificates && \
    curl -sSL -o /usr/local/bin/mc https://github.com/minio/mc/releases/download/RELEASE.2025-08-13T08-35-41Z/mc.linux-amd64.RELEASE.2025-08-13T08-35-41Z && \
    chmod +x /usr/local/bin/mc

ENTRYPOINT ["/bin/sh", "-c"]
