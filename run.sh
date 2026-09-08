#!/usr/bin/env bash
# Launch Söz dev environment — API + Metro in two terminal windows.
#
# Usage:
#   ./run.sh              # tunnel mode (default — works through internet)
#   ./run.sh lan          # local network mode (faster, needs same WiFi)
#   ./run.sh clear        # tunnel + clear Metro cache
#   ./run.sh stop         # kill any running API/Metro processes

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

MODE="${1:-tunnel}"

# ─────────────────────────────────────────────────────────────
# Stop mode — kill running processes
# ─────────────────────────────────────────────────────────────
if [ "$MODE" = "stop" ] || [ "$MODE" = "kill" ]; then
  echo "🛑 Stopping running Söz processes..."
  pkill -f "tsx watch src/index.ts" 2>/dev/null && echo "  · API stopped" || echo "  · API was not running"
  pkill -f "expo start" 2>/dev/null && echo "  · Metro stopped" || echo "  · Metro was not running"
  pkill -f "metro/src/index" 2>/dev/null || true
  echo "✓ Done."
  exit 0
fi

# ─────────────────────────────────────────────────────────────
# Prerequisite checks
# ─────────────────────────────────────────────────────────────
if ! command -v pnpm >/dev/null 2>&1; then
  echo "❌ pnpm not found. Install with: npm install -g pnpm@10"
  exit 1
fi

if [ ! -d "node_modules" ] || [ ! -d "apps/mobile/node_modules" ]; then
  echo "📦 Installing dependencies (first run, takes 1-3 min)..."
  pnpm install
fi

if [ ! -f "apps/api/.env" ]; then
  echo "⚠️  apps/api/.env not found. Copying from .env.example..."
  cp apps/api/.env.example apps/api/.env
  echo "   Now fill in your API keys in apps/api/.env"
  exit 1
fi

# Free port 3000 if a stale API is occupying it
if lsof -i :3000 >/dev/null 2>&1; then
  echo "⚠️  Port 3000 is in use — stopping old API process..."
  pkill -f "tsx watch src/index.ts" 2>/dev/null || true
  sleep 1
fi

# ─────────────────────────────────────────────────────────────
# Build commands
# ─────────────────────────────────────────────────────────────
case "$MODE" in
  tunnel)
    METRO_CMD="npx expo start --tunnel"
    METRO_LABEL="Metro (tunnel)"
    ;;
  lan|local)
    METRO_CMD="npx expo start"
    METRO_LABEL="Metro (LAN)"
    ;;
  clear)
    METRO_CMD="npx expo start --tunnel --clear"
    METRO_LABEL="Metro (tunnel, cleared)"
    ;;
  *)
    echo "Usage: $0 [tunnel|lan|clear|stop]"
    echo "  tunnel  Expo with --tunnel (default — works through internet)"
    echo "  lan     Expo on local network (faster, requires same WiFi)"
    echo "  clear   tunnel + --clear (reset Metro cache)"
    echo "  stop    kill running API/Metro"
    exit 1
    ;;
esac

API_CMD="pnpm api:dev"

# Wrap so the window stays open if the process exits, showing the error
api_wrapped="cd '$ROOT_DIR' && echo '🤖 Starting Söz API on :3000' && $API_CMD; echo; echo '--- API exited (press Enter to close) ---'; read"
metro_wrapped="cd '$ROOT_DIR/apps/mobile' && echo '📱 Starting $METRO_LABEL' && $METRO_CMD; echo; echo '--- Metro exited (press Enter to close) ---'; read"

# ─────────────────────────────────────────────────────────────
# Spawn — gnome-terminal multi-tab CLI is buggy when mixing
# different commands per tab, so we open TWO SEPARATE WINDOWS.
# Reliable across all distros that have gnome-terminal.
# ─────────────────────────────────────────────────────────────
if [ -n "${TMUX:-}" ]; then
  tmux new-window -n "API" "bash -ic \"$api_wrapped\""
  tmux new-window -n "Metro" "bash -ic \"$metro_wrapped\""
  echo "✅ Opened API and Metro in new tmux windows. Switch with Ctrl-B then n."

elif command -v gnome-terminal >/dev/null 2>&1; then
  # Two separate windows — most reliable approach
  gnome-terminal --title="🤖 Söz API" -- bash -c "$api_wrapped" &
  sleep 0.6  # let API claim port 3000 first so we see clean Metro output
  gnome-terminal --title="📱 Söz $METRO_LABEL" -- bash -c "$metro_wrapped" &

elif command -v konsole >/dev/null 2>&1; then
  konsole --new-tab -e bash -c "$api_wrapped" &
  sleep 0.6
  konsole --new-tab -e bash -c "$metro_wrapped" &

elif command -v xfce4-terminal >/dev/null 2>&1; then
  xfce4-terminal --title="API" --command="bash -c \"$api_wrapped\"" &
  sleep 0.6
  xfce4-terminal --title="Metro" --command="bash -c \"$metro_wrapped\"" &

elif command -v xterm >/dev/null 2>&1; then
  xterm -T "Söz API" -e bash -c "$api_wrapped" &
  sleep 0.6
  xterm -T "Söz Metro" -e bash -c "$metro_wrapped" &

else
  echo "⚠️  No supported terminal emulator found."
  echo "Run these manually in two separate terminals:"
  echo
  echo "  Terminal 1:"
  echo "    cd '$ROOT_DIR' && $API_CMD"
  echo
  echo "  Terminal 2:"
  echo "    cd '$ROOT_DIR/apps/mobile' && $METRO_CMD"
  exit 1
fi

cat <<EOF

📍 What's running:
   API:    http://localhost:3000   (in the "Söz API" window)
   Metro:  see the "$METRO_LABEL" window for QR code

💡 Tips:
   ./run.sh stop      stop both
   ./run.sh lan       use LAN mode
   ./run.sh clear     restart with cleared Metro cache

EOF
