#!/usr/bin/env bash
# Start PostgreSQL (if not running) and ensure the `todolist` database exists.
# Usage: pnpm db:start
# Strategies tried in order:
#   1. EnterpriseDB installer (macOS):   /Library/PostgreSQL/<ver>/bin/pg_ctl
#   2. Homebrew services (macOS):        brew services start postgresql@<ver>
#   3. systemd (Linux):                  sudo systemctl start postgresql
#   4. SysV service (Linux):             sudo service postgresql start
#   5. Docker (any platform):            docker run -d --name todolist-postgres ...
# After starting, polls pg_isready / TCP until ready (15s budget), then
# creates the `todolist` database via `createdb` (or `psql -c CREATE DATABASE`).

set -euo pipefail

PG_HOST="${PG_HOST:-localhost}"
PG_PORT="${PG_PORT:-5432}"
PG_USER="${PG_USER:-postgres}"
PG_DB="${PG_DB:-todolist}"
PG_DATA="${PG_DATA:-}"   # optional override for EDB pg_ctl -D
# PGPASSWORD is intentionally NOT defaulted — see prompt_password() below.

c_red="\033[31m"; c_grn="\033[32m"; c_yel="\033[33m"; c_dim="\033[2m"; c_off="\033[0m"
say()  { printf "%b\n" "$*"; }
ok()   { say "${c_grn}✓${c_off} $*"; }
warn() { say "${c_yel}!${c_off} $*"; }
err()  { say "${c_red}✗${c_off} $*" >&2; }

# --- EDB installer detection -------------------------------------------------
# The EnterpriseDB / PostgreSQL installer (official macOS .dmg) installs to
# /Library/PostgreSQL/<major>/ and does NOT put its bin on PATH by default.
# If we see it, prepend to PATH so pg_isready / psql / createdb become
# available for the rest of the script.
edb_bin() {
  if [ -d /Library/PostgreSQL ]; then
    ls -d /Library/PostgreSQL/*/bin 2>/dev/null | sort -V | tail -1
  fi
}
edb_version() {
  edb_bin | sed 's|.*/PostgreSQL/||;s|/bin$||'
}
if [ -n "$(edb_bin)" ]; then
  export PATH="$(edb_bin):$PATH"
fi

wait_for_pg() {
  local tries=30  # 30 * 0.5s = 15s
  while [ "$tries" -gt 0 ]; do
    if command -v pg_isready >/dev/null 2>&1; then
      pg_isready -h "$PG_HOST" -p "$PG_PORT" -q && return 0
    else
      # Fall back to a raw TCP probe
      (echo > "/dev/tcp/$PG_HOST/$PG_PORT") >/dev/null 2>&1 && return 0
    fi
    sleep 0.5
    tries=$((tries - 1))
  done
  return 1
}

db_exists() {
  if command -v psql >/dev/null 2>&1; then
    PGPASSWORD="${PGPASSWORD:-postgres}" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw "$PG_DB"
  else
    return 2  # 2 = "could not verify" (psql missing); 1 = "verified absent"
  fi
}

create_db() {
  if command -v createdb >/dev/null 2>&1; then
    PGPASSWORD="${PGPASSWORD:-postgres}" createdb -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" "$PG_DB"
  elif command -v psql >/dev/null 2>&1; then
    PGPASSWORD="${PGPASSWORD:-postgres}" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -c "CREATE DATABASE \"$PG_DB\"" postgres
  else
    return 2  # 2 = "no client tools available"
  fi
}

ensure_client_tools() {
  if command -v psql >/dev/null 2>&1 || command -v createdb >/dev/null 2>&1; then
    return 0
  fi
  err "neither psql nor createdb is installed — cannot verify or create the database"
  err "  macOS + Homebrew PG:  brew install postgresql@16      (then ensure libpq is on PATH)"
  err "  Linux (Debian/Ubuntu):  sudo apt install postgresql-client"
  err "  Or use a DB GUI that ships a CLI"
  return 1
}

# Prompt for the PG password if PGPASSWORD isn't already in the environment.
# Silent read (no echo). Refuses to fall back to any hardcoded value.
prompt_password() {
  if [ -n "${PGPASSWORD:-}" ]; then
    return 0
  fi
  if [ ! -t 0 ]; then
    err "PGPASSWORD is not set and stdin is not a TTY (can't prompt)"
    err "  fix: export PGPASSWORD='…'  before running this script"
    return 1
  fi
  read -rs -p "PostgreSQL password for '${PG_USER}@${PG_HOST}:${PG_PORT}': " pw
  echo  # newline after the silent read
  if [ -z "$pw" ]; then
    err "empty password — refusing to guess"
    err "  fix: set it in PGPASSWORD, or re-run and type it"
    return 1
  fi
  PGPASSWORD="$pw"
  export PGPASSWORD
}

start_pg() {
  # EnterpriseDB / PostgreSQL installer (macOS). Uses pg_ctl directly.
  if [ -d /Library/PostgreSQL ]; then
    local ver
    ver="$(edb_version)"
    local data="${PG_DATA:-/Library/PostgreSQL/$ver/data}"
    if [ -d "$data" ]; then
      say "${c_dim}→ /Library/PostgreSQL/$ver/bin/pg_ctl -D $data -l /tmp/pg.log start${c_off}"
      if "/Library/PostgreSQL/$ver/bin/pg_ctl" -D "$data" -l /tmp/pg.log start; then
        return 0
      fi
      warn "pg_ctl start failed — try manually: pg_ctl -D $data -l /tmp/pg.log start"
    fi
  fi

  if command -v brew >/dev/null 2>&1; then
    # macOS + Homebrew. Try installed versions in order of recency.
    for v in postgresql@17 postgresql@16 postgresql@15 postgresql@14 postgresql; do
      if brew list "$v" >/dev/null 2>&1; then
        say "${c_dim}→ brew services start $v${c_off}"
        brew services start "$v" && return 0
      fi
    done
    warn "Homebrew found, but no postgresql formula installed"
    warn "  install with: brew install postgresql@16"
  fi

  if command -v systemctl >/dev/null 2>&1; then
    say "${c_dim}→ sudo systemctl start postgresql${c_off}"
    sudo systemctl start postgresql && return 0
  fi

  if command -v service >/dev/null 2>&1; then
    say "${c_dim}→ sudo service postgresql start${c_off}"
    sudo service postgresql start && return 0
  fi

  if command -v docker >/dev/null 2>&1; then
    if ! docker ps -a --format '{{.Names}}' | grep -q '^todolist-postgres$'; then
      say "${c_dim}→ docker run -d --name todolist-postgres -p ${PG_PORT}:5432 -e POSTGRES_PASSWORD=postgres postgres${c_off}"
      docker run -d --name todolist-postgres \
        -e POSTGRES_USER="$PG_USER" \
        -e POSTGRES_PASSWORD="${PGPASSWORD:-postgres}" \
        -p "${PG_PORT}:5432" \
        postgres:latest
    else
      say "${c_dim}→ docker start todolist-postgres${c_off}"
      docker start todolist-postgres
    fi
    return 0
  fi

  err "no supported PostgreSQL manager found (brew / systemctl / service / docker)"
  err "start PostgreSQL manually, then re-run this script"
  exit 1
}

# ---------- main ----------

say "Checking PostgreSQL at ${PG_HOST}:${PG_PORT}…"

if wait_for_pg; then
  ok "PostgreSQL is already running"
else
  warn "PostgreSQL not reachable — trying to start it"
  start_pg
  if wait_for_pg; then
    ok "PostgreSQL started"
  else
    err "PostgreSQL did not become ready in 15s"
    exit 1
  fi
fi

if ! ensure_client_tools; then
  exit 1
fi

if ! prompt_password; then
  exit 1
fi

case "$(db_exists; echo $?)" in
  0) ok "database '${PG_DB}' exists" ;;
  1) say "creating database '${PG_DB}'…"
     if create_db; then
       ok "database '${PG_DB}' created"
     else
       err "failed to create database '${PG_DB}'"
       err "  createdb -h $PG_HOST -p $PG_PORT -U $PG_USER $PG_DB"
       exit 1
     fi
     ;;
  *) err "could not verify database '${PG_DB}' exists — refusing to claim ready"
     exit 1 ;;
esac

ok "ready — connection string:"
say "  ${c_dim}postgresql://${PG_USER}:***@${PG_HOST}:${PG_PORT}/${PG_DB}${c_off}"
say "  ${c_dim}(set the same password in backend/nodejs/.env and backend/python/.env as DATABASE_URL)${c_off}"
