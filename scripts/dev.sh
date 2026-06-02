#!/usr/bin/env bash
# Pick a backend (and optionally the frontend) to start.
# Usage:
#   pnpm dev                              # interactive picker
#   pnpm dev -- --backend=node            # non-interactive
#   pnpm dev -- --backend=dotnet --with-frontend

set -euo pipefail

c_red="\033[31m"; c_yel="\033[33m"; c_off="\033[0m"
say()  { printf "%b\n" "$*"; }
warn() { say "${c_yel}!${c_off} $*"; }
err()  { say "${c_red}✗${c_off} $*" >&2; }

BACKEND=""
WITH_FRONTEND=""
WITH_DB=""

for arg in "$@"; do
  case "$arg" in
    --backend=*)      BACKEND="${arg#*=}" ;;
    --with-frontend)  WITH_FRONTEND=1 ;;
    --no-frontend)    WITH_FRONTEND=0 ;;
    --with-db)        WITH_DB=1 ;;
    --no-db)          WITH_DB=0 ;;
    -h|--help)
      cat <<EOF
Usage: pnpm dev [options]
  --backend=<node|dotnet|python>   pick backend (skips prompt)
  --with-frontend                  also start the Vite dev server
  --no-frontend                    backend only (default)
  --with-db                        run pnpm db:start before launching backend
  --no-db                          skip the db:start prompt (default)
EOF
      exit 0 ;;
  esac
done

if [ -z "$BACKEND" ]; then
  echo "Which backend?"
  echo "  1) node    (Fastify + Prisma,    port 5555)"
  echo "  2) dotnet  (ASP.NET Core + EF,   port 5555)"
  echo "  3) python  (FastAPI + SQLAlchemy, port 5555)"
  read -r -p "Pick [1-3]: " choice
  case "$choice" in
    1) BACKEND="node" ;;
    2) BACKEND="dotnet" ;;
    3) BACKEND="python" ;;
    *) echo "Invalid choice: $choice" >&2; exit 1 ;;
  esac
fi

if [ -z "$WITH_FRONTEND" ]; then
  read -r -p "Start frontend too? [y/N]: " yn
  case "$yn" in
    y|Y|yes|YES) WITH_FRONTEND=1 ;;
    *)           WITH_FRONTEND=0 ;;
  esac
fi

if [ -z "$WITH_DB" ]; then
  read -r -p "Run pnpm db:start (start PostgreSQL + create todolist db)? [y/N]: " yn
  case "$yn" in
    y|Y|yes|YES) WITH_DB=1 ;;
    *)           WITH_DB=0 ;;
  esac
fi

case "$BACKEND" in
  node)   BACKEND_CMD="pnpm --filter backend dev" ;;
  dotnet) BACKEND_CMD="cd backend/donet/TodoApi && dotnet run" ;;
  python) BACKEND_CMD="cd backend/python && .venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 5555 --reload" ;;
  *) echo "Unknown backend: $BACKEND" >&2; exit 1 ;;
esac

echo "→ backend: $BACKEND  frontend: $([ "$WITH_FRONTEND" = "1" ] && echo yes || echo no)  db: $([ "$WITH_DB" = "1" ] && echo yes || echo no)"

# Pre-flight port cleanup. Shared logic with the predev script — see
# scripts/kill-ports.sh. If it can't free a port we refuse to start the
# backend (it would just fail with EADDRINUSE a few seconds later).
if ! bash scripts/kill-ports.sh --all; then
  err "could not free a required port — see errors above"
  err "  try: lsof -i :5555      to see who still has it"
  err "  or:  bash scripts/kill-ports.sh 5555    with sudo"
  exit 1
fi

if [ "$WITH_DB" = "1" ]; then
  pnpm db:start
fi

# --- High-resolution :5555 watcher ------------------------------------------
# Samples who is bound to :5555 every 100ms for the entire backend startup.
# If uvicorn fails with EADDRINUSE we'll dump the log to see who grabbed the
# port in between our pre-launch check and uvicorn's bind() call.
WATCH_LOG="/tmp/picker-port-watch.log"
: > "$WATCH_LOG"
(
  echo "[$(date +%H:%M:%S.%3N)] watcher started, parent=$$" >> "$WATCH_LOG"
  prev=""
  while true; do
    pid=$(lsof -ti tcp:5555 2>/dev/null | head -1)
    if [ "$pid" != "$prev" ]; then
      if [ -n "$pid" ]; then
        cmd=$(ps -o command= -p "$pid" 2>/dev/null | head -c 120)
        ppid=$(ps -o ppid= -p "$pid" 2>/dev/null | xargs)
        echo "[$(date +%H:%M:%S.%3N)] +bind  pid=$pid ppid=$ppid cmd=$cmd" >> "$WATCH_LOG"
      else
        echo "[$(date +%H:%M:%S.%3N)] -free" >> "$WATCH_LOG"
      fi
      prev="$pid"
    fi
    sleep 0.1
  done
) &
WATCHER_PID=$!
say "→ port watcher started (pid $WATCHER_PID, log: $WATCH_LOG)"

# One-shot pre-launch snapshot (also printed live for clarity).
pre_bind=$(lsof -nP -iTCP:5555 -sTCP:LISTEN 2>/dev/null || true)
if [ -n "$pre_bind" ]; then
  warn ":5555 already in LISTEN state right before backend launch:"
  say "$pre_bind" | sed 's/^/    /'
else
  say "→ :5555 is free, starting backend"
fi

if [ "$WITH_FRONTEND" = "1" ]; then
  # Sequential: backend first → wait for /health 200 → then frontend.
  # Avoids the race where Vite starts proxying before the backend listens.
  bash -c "$BACKEND_CMD" &
  BACKEND_PID=$!
  trap "kill $BACKEND_PID 2>/dev/null || true; kill $WATCHER_PID 2>/dev/null || true" EXIT

  printf "waiting for backend on :5555"
  for _ in $(seq 1 60); do  # 60 * 0.5s = 30s budget
    if curl -sf http://localhost:5555/health >/dev/null 2>&1; then
      echo "  → ready"
      break
    fi
    if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
      echo
      err "backend exited during startup — :5555 activity during launch:"
      sed 's/^/    /' "$WATCH_LOG"
      exit 1
    fi
    printf "."
    sleep 0.5
  done

  if ! curl -sf http://localhost:5555/health >/dev/null 2>&1; then
    echo
    err "backend did not become healthy in 30s — :5555 activity:"
    sed 's/^/    /' "$WATCH_LOG"
    kill "$BACKEND_PID" 2>/dev/null || true
    exit 1
  fi

  kill "$WATCHER_PID" 2>/dev/null || true
  pnpm --filter frontend dev
else
  # No frontend: also keep the watcher running so we can see the bind log
  # if the backend itself fails to start in this branch.
  bash -c "$BACKEND_CMD" &
  BACKEND_PID=$!
  trap "kill $BACKEND_PID 2>/dev/null || true; kill $WATCHER_PID 2>/dev/null || true" EXIT
  wait "$BACKEND_PID" || {
    rc=$?
    err "backend exited with code $rc — :5555 activity:"
    sed 's/^/    /' "$WATCH_LOG"
    exit $rc
  }
fi
