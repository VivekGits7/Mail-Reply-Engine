ARG MINIO_BASE_IMAGE=cgr.dev/chainguard/minio:latest
FROM ${MINIO_BASE_IMAGE}

COPY --chmod=755 init.sh /usr/local/bin/init-minio.sh

EXPOSE 9000 9001

ENTRYPOINT ["minio"]
CMD ["server", "--address", ":9000", "--console-address", ":9001", "/data"]
