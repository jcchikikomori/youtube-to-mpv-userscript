#!/bin/bash
# Install MPV handler as systemd user service

set -e

SERVICE_NAME="mpv-handler"
SERVICE_DIR="$HOME/.config/systemd/user"
INSTALL_DIR="$HOME/.local/share/youtube-to-mpv"

echo "Installing MPV handler..."

mkdir -p "$SERVICE_DIR" "$INSTALL_DIR"
cp mpv-handler.py "$INSTALL_DIR/"
cp mpv-handler.service "$SERVICE_DIR/"

systemctl --user daemon-reload
systemctl --user enable "$SERVICE_NAME"
systemctl --user start "$SERVICE_NAME"

echo "✓ MPV handler installed and started"
echo ""
echo "Commands:"
echo "  systemctl --user status $SERVICE_NAME   # Check status"
echo "  systemctl --user stop $SERVICE_NAME      # Stop"
echo "  systemctl --user restart $SERVICE_NAME   # Restart"
echo "  journalctl --user -u $SERVICE_NAME       # View logs"
echo ""
echo "To start on login:"
echo "  loginctl enable-linger $USER"
