#!/bin/sh
# Өдөр бүр (zkh013-backup.timer): MongoDB-ийн хуулбар /srv/zkh013/backups-д, 14 хоног хадгална.
# Зураг, бичлэгүүд /srv/zkh013/uploads-д байгаа — тэдгээрийг backups-ийн хамт өөр диск/компьютер руу үе үе хуулна.
# Чатын зурвас, файл, уншсан/устгасан тэмдэглэл (chatmessages, chatfiles, chatreceipts, chatdeletions) хуулбарт
# орохгүй — уншигдмагц,
# татагдмагц устдаг тул хаана ч үлдэх ёсгүй. Чатын файлууд (/srv/zkh013/chat-files) ч хуулбарлагдахгүй.
set -eu
DIR=/srv/zkh013/backups
mkdir -p "$DIR"
FILE="$DIR/zkh013-$(date +%F).archive.gz"
docker exec zkh013-mongo sh -c 'mongodump --quiet --username "$MONGO_INITDB_ROOT_USERNAME" \
  --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --db zkh013 \
  --excludeCollection chatmessages --excludeCollection chatfiles --excludeCollection chatreceipts --excludeCollection chatdeletions --archive --gzip' > "$FILE.part"
mv "$FILE.part" "$FILE"
find "$DIR" -name 'zkh013-*.archive.gz' -mtime +14 -delete
