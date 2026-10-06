# Winziges Image nur für die tägliche Datenbanksicherung (Phase 3): enthält
# pg_dump/psql (vom postgres-Image), das in Alpine/BusyBox bereits enthaltene
# crond für den täglichen Lauf (das separate Paket "dcron" bricht in manchen
# eingeschränkten Container-Umgebungen mit "setpgid: Operation not permitted"
# ab) und rsync für die externe Kopie. openssh-client: rsync auf einen anderen
# Server per SSH-Schlüssel. age: optionale Verschlüsselung der Sicherung (nur
# aktiv, wenn BACKUP_VERSCHLUESSELUNG_SCHLUESSEL gesetzt ist).
FROM postgres:16.10-alpine
RUN apk add --no-cache rsync openssh-client age
COPY docker/crontab /etc/crontabs/root
COPY scripts/backup.sh /usr/local/bin/backup.sh
COPY scripts/restore.sh /usr/local/bin/restore.sh
RUN chmod +x /usr/local/bin/backup.sh /usr/local/bin/restore.sh
CMD ["crond", "-f", "-l", "2"]
