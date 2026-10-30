#!/bin/sh
set -eu

# Neon can briefly hold Prisma's advisory lock when another connection or
# deployment has just run. Do not let that transient condition cause a restart
# loop or make the HTTP API disappear.
attempt=1
max_attempts="${PRISMA_MIGRATE_RETRIES:-6}"

while :; do
  if pnpm exec prisma migrate deploy; then
    break
  fi

  if [ "$attempt" -ge "$max_attempts" ]; then
    echo "[startup] Prisma migrations failed after ${attempt} attempts; not starting the API."
    exit 1
  fi

  delay=$((attempt * 5))
  echo "[startup] Migration attempt ${attempt}/${max_attempts} failed; retrying in ${delay}s..."
  sleep "$delay"
  attempt=$((attempt + 1))
done

exec pnpm start
