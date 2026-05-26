#!/bin/bash
# Flip any messages stuck on status='answering' to 'error' so the UI
# doesn't block resubmission. Called by Vane.app after containers come up.
# Safe to run anytime; idempotent.
#
# Uses docker exec node + better-sqlite3 to update the DB in-place.
# This avoids docker cp which replaces the file inode and triggers
# SQLITE_READONLY_DBMOVED in Vane's open connection.

CONTAINER="vane-vane-1"

if ! /usr/local/bin/docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "unstick: ${CONTAINER} not running, skipping"
  exit 0
fi

/usr/local/bin/docker exec "${CONTAINER}" node -e "
const Database = require('/home/vane/node_modules/better-sqlite3');
const db = new Database('/home/vane/data/db.sqlite');
const stuck = db.prepare(\"SELECT count(*) as n FROM messages WHERE status='answering'\").get().n;
if (stuck > 0) {
  db.prepare(\"UPDATE messages SET status='error' WHERE status='answering'\").run();
  console.log('unstick: cleared ' + stuck + ' stuck message(s)');
} else {
  console.log('unstick: nothing to clean');
}
db.close();
" 2>&1
