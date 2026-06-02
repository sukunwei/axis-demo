#!/usr/bin/env bash
# Kill whatever process is holding the given ports, then wait for the ports
# to actually be free before returning. Exits non-zero if any port is still
# held after the kill attempts.
#
# Default ports match what the project actually uses:
#   5555  — backend (any of Node / .NET / Python)
#   5173  — Vite dev server (frontend)
#
# Usage: bash scripts/kill-ports.sh
#        bash scripts/kill-ports.sh --all
#        bash scripts/kill-ports.sh 5555 5173

set -uo pipefail

if [ "${1:-}" = "--all" ] || [ $# -eq 0 ]; then
  PORTS=(5555 5173)
else
  PORTS=("$@")
fi

c_red="\033[31m"; c_yel="\033[33m"; c_grn="\033[32m"; c_off="\033[0m"
say()  { printf "%b\n" "$*"; }
ok()   { say "${c_grn}✓${c_off} $*"; }
warn() { say "${c_yel}!${c_off} $*"; }
err()  { say "${c_red}✗${c_off} $*" >&2; }

# Try multiple methods to find pids listening on a port.
# Returns one pid per line on stdout; empty if nothing found.
pids_on_port() {
  local port=$1
  local pids=""

  if command -v lsof >/dev/null 2>&1; then
    pids+="$(lsof -ti tcp:"$port" 2>/dev/null)"
  fi

  if [ -z "$pids" ] && command -v fuser >/dev/null 2>&1; then
    # fuser outputs " <pid> <pid>"; strip the leading space
    pids+="$(fuser -n tcp "$port" 2>/dev/null | tr -s ' \n' ' ' | xargs -n1 echo)"
  fi

  if [ -z "$pids" ] && command -v ss >/dev/null 2>&1; then
    # ss -tlnp gives "users:((\"python\",pid=1234,fd=5))" — extract pid=
    pids+="$(ss -tlnp "sport = :$port" 2>/dev/null | grep -oE 'pid=[0-9]+' | cut -d= -f2)"
  fi

  # Deduplicate and trim
  printf "%s\n" "$pids" | sort -u | grep -E '^[0-9]+$' || true
}

port_is_free() {
  local port=$1
  # TCP connect probe: fails fast if the port is bound
  (echo > "/dev/tcp/127.0.0.1/$port") >/dev/null 2>&1 && return 1 || return 0
}

wait_port_free() {
  local port=$1
  local tries=20  # 20 * 0.25s = 5s budget
  while [ "$tries" -gt 0 ]; do
    if port_is_free "$port"; then
      return 0
    fi
    sleep 0.25
    tries=$((tries - 1))
  done
  return 1
}

kill_port() {
  local port=$1
  local pids
  pids="$(pids_on_port "$port")"

  if [ -z "$pids" ]; then
    return 0
  fi

  local me uid
  me="$(whoami)"
  uid="$(id -u)"

  for pid in $pids; do
    local owner
    owner="$(ps -o user= -p "$pid" 2>/dev/null || true)"
    if [ -n "$owner" ] && [ "$uid" != "0" ] && [ "$owner" != "$me" ]; then
      warn ":$port → pid $pid owned by '$owner' (not us) — skipping"
      continue
    fi
    if kill -9 "$pid" 2>/dev/null; then
      warn ":$port → killed pid $pid"
    else
      warn ":$port → failed to kill pid $pid (already gone or zombie)"
    fi
  done

  if wait_port_free "$port"; then
    ok ":$port is free"
    return 0
  else
    err ":$port still bound after 5s — refusing to proceed"
    err "  try: lsof -i :$port   to see who still has it"
    return 1
  fi
}

failed=0
for port in "${PORTS[@]}"; do
  kill_port "$port" || failed=1
done

exit "$failed"
