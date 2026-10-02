# Winziges Image nur für die tägliche Datenbanksicherung (Phase 3): enthält
# pg_dump/psql (vom postgres-Image), das in Alpine/BusyBox bereits enthaltene
# crond für den täglichen Lauf (das separate Paket "dcron" bricht in manchen
# eingeschränkten Container-Umgebungen mit "setpgid: Operation not permitted"
# ab) und rsync für die externe Kopie.
FROM postgres:16-alpine
RUN apk add --no-cache rsync
COPY docker/crontab /etc/crontabs/root
COPY scripts/backup.sh /usr/local/bin/backup.sh
COPY scripts/restore.sh /usr/local/bin/restore.sh
RUN chmod +x /usr/local/bin/backup.sh /usr/local/bin/restore.sh
CMD ["crond", "-f", "-l", "2"]
