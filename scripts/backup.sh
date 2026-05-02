#!/bin/bash
set -euo pipefail

BACKUP_DIR="/backups/cortex"
DATE=$(date +%Y%m%d_%H%M%S)
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"

mkdir -p $BACKUP_DIR

echo "Starting backup at $(date)"

# Backup PostgreSQL
echo "Backing up PostgreSQL..."
docker compose -f $COMPOSE_FILE exec -T cortex-db \
  pg_dump -U ${PG_USER:-cortex} ${PG_DATABASE:-cortex} > $BACKUP_DIR/postgres_$DATE.sql || {
  echo "PostgreSQL backup failed"
  exit 1
}

# Backup ClickHouse (if using)
if docker compose -f $COMPOSE_FILE ps clickhouse | grep -q "Up"; then
  echo "Backing up ClickHouse..."
  docker compose -f $COMPOSE_FILE exec -T clickhouse \
    clickhouse-client --query "BACKUP DATABASE ${CLICKHOUSE_DB:-cortex} TO Disk('backups', 'backup_$DATE.zip')" || {
    echo "ClickHouse backup failed (non-critical)"
  }
fi

# Compress PostgreSQL backup
gzip $BACKUP_DIR/postgres_$DATE.sql

# Keep only last 7 days of backups
echo "Cleaning up old backups..."
find $BACKUP_DIR -type f -mtime +7 -delete

echo "Backup completed: $DATE"
echo "Backup location: $BACKUP_DIR"






