#!/bin/bash

# Install (or update) the Market Clock bar widget into Omarchy.
#
#   ./install.sh            install from GitHub with `omarchy plugin add`, or
#                           fast-forward an existing git install
#   ./install.sh --local    copy this checkout into ~/.config/omarchy/plugins
#                           (for hacking on the plugin; no git remote needed)
#   ./install.sh --dry-run  print what would happen and change nothing
#
# Only touches ~/.config/omarchy/plugins/<id>/ (through Omarchy's own plugin
# commands where possible) and the bar layout in ~/.config/omarchy/shell.json
# via `omarchy plugin enable`. Never writes under ~/.local/share/omarchy or
# $OMARCHY_PATH, never uses sudo. Safe to run repeatedly.

set -euo pipefail

ID="io.github.terminalgravity.market-clock"
REPO_URL="${MARKET_CLOCK_REPO_URL:-https://github.com/TerminalGravity/omarchy-market-clock.git}"
PLUGINS_DIR="$HOME/.config/omarchy/plugins"
TARGET="$PLUGINS_DIR/$ID"
SRC_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
FILES=(manifest.json BarWidget.qml Model.js LICENSE README.md)

LOCAL=0
DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
  --local) LOCAL=1 ;;
  --dry-run | -n) DRY_RUN=1 ;;
  -h | --help)
    sed -n '3,15p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
    exit 0
    ;;
  *)
    echo "install.sh: unknown option: $arg" >&2
    exit 1
    ;;
  esac
done

run() {
  if ((DRY_RUN)); then
    printf 'would run:'
    printf ' %q' "$@"
    printf '\n'
  else
    "$@"
  fi
}

need() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "install.sh: '$1' not found. This plugin needs Omarchy with omarchy-shell (Quattro or later)." >&2
    exit 1
  }
}

need omarchy-plugin-validate
need omarchy-plugin-enable
need omarchy-shell

if ((LOCAL)); then
  omarchy-plugin-validate "$SRC_DIR"
  if [[ -d $TARGET/.git ]]; then
    echo "install.sh: $TARGET is a git install; run ./uninstall.sh first to switch to --local." >&2
    exit 1
  fi
  run mkdir -p "$TARGET"
  for f in "${FILES[@]}"; do
    run install -m 644 "$SRC_DIR/$f" "$TARGET/$f"
  done
  run omarchy-shell shell rescanPlugins
  echo "Copied $ID into $TARGET"
elif [[ -d $TARGET/.git ]]; then
  echo "$ID is already installed; checking for updates."
  run omarchy-plugin-update "$ID" --yes
elif [[ -e $TARGET ]]; then
  echo "$ID is installed from a local copy; re-run with --local to refresh it." >&2
  exit 1
else
  run omarchy-plugin-add "$REPO_URL" --yes
fi

# Enable once. Enabling an already-placed widget would only re-place it, so
# skip it when shell.json already mentions the id.
if [[ -f $HOME/.config/omarchy/shell.json ]] && grep -q "\"$ID\"" "$HOME/.config/omarchy/shell.json"; then
  echo "$ID is already enabled."
else
  run omarchy-plugin-enable "$ID"
fi

echo "Done. Left click toggles countdown/clock, right click sends a status notification."
