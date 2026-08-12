#!/bin/bash
# Start the MPV handler server in the background

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="/tmp/mpv-handler.pid"

if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    echo "MPV handler already running (PID: $(cat "$PID_FILE"))"
    exit 0
fi

python3 "$SCRIPT_DIR/mpv-handler.py" &
echo $! > "$PID_FILE"
echo "MPV handler started (PID: $!)"
