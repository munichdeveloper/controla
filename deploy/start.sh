#!/bin/bash
set -eu

# Docker sets HOSTNAME to the container ID; Next.js must listen on all interfaces.
export HOSTNAME="${FRONTEND_BIND_ADDRESS:-0.0.0.0}"
export PORT="${PORT:-3000}"
java -jar /app/backend.jar &
backend_pid=$!
(cd /app/frontend && exec node server.js) &
frontend_pid=$!

cleanup() {
    kill -TERM "$backend_pid" "$frontend_pid" 2>/dev/null || true
    wait "$backend_pid" "$frontend_pid" 2>/dev/null || true
}
trap 'cleanup; exit 0' TERM INT

# Either process ending means the combined service needs to restart.
set +e
wait -n "$backend_pid" "$frontend_pid"
status=$?
cleanup
if [ "$status" -eq 0 ]; then status=1; fi
exit "$status"
