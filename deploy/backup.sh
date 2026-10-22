#!/bin/sh
# Өдөр бүр (zkh013-backup.timer): MongoDB-ийн хуулбар /srv/zkh013/backups-д, 14 хоног хадгална.
# Зураг, бичлэгүүд /srv/zkh013/uploads-д байгаа — тэдгээрийг backups-ийн хамт өөр диск/компьютер руу үе үе хуулна.
set -eu
DIR=/srv/zkh013/backups
mkdir -p "$DIR"
FILE="$DIR/zkh013-$(date +%F).archive.gz"
docker exec zkh013-mongo sh -c 'mongodump --quiet --username "$MONGO_INITDB_ROOT_USERNAME" \
  --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --db zkh013 --archive --gzip' > "$FILE.part"
mv "$FILE.part" "$FILE"
find "$DIR" -name 'zkh013-*.archive.gz' -mtime +14 -delete
