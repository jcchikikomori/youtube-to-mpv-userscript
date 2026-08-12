#!/bin/bash
# Uninstall MPV handler systemd service

set -e

SERVICE_NAME="mpv-handler"
SERVICE_DIR="$HOME/.config/systemd/user"
INSTALL_DIR="$HOME/.local/share/youtube-to-mpv"

echo "Uninstalling MPV handler..."

systemctl --user stop "$SERVICE_NAME" 2>/dev/null || true
systemctl --user disable "$SERVICE_NAME" 2>/dev/null || true
rm -f "$SERVICE_DIR/$SERVICE_NAME.service"
rm -rf "$INSTALL_DIR"
systemctl --user daemon-reload

echo "✓ MPV handler uninstalled"
