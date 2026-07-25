#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MONGO_BIN="/c/Program Files/MongoDB/Server/8.3/bin/mongod.exe"
DATA_DIR="$ROOT/.data/mongo"
mkdir -p "$DATA_DIR"

if ! curl -s http://127.0.0.1:27017 >/dev/null 2>&1; then
  echo "Starting MongoDB…"
  "$MONGO_BIN" --dbpath "$DATA_DIR" --port 27017 --bind_ip 127.0.0.1 &
  sleep 2
fi

cd "$ROOT/backend"
npm run dev
