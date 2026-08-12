#!/bin/bash
# Stop the MPV handler server

PID_FILE="/tmp/mpv-handler.pid"

if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
        kill "$PID"
        rm "$PID_FILE"
        echo "MPV handler stopped"
    else
        rm "$PID_FILE"
        echo "MPV handler was not running"
    fi
else
    echo "MPV handler not running"
fi
