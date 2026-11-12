#!/bin/bash

# Remove the Market Clock bar widget from Omarchy.
#
#   ./uninstall.sh            disable and remove it with `omarchy plugin remove`
#   ./uninstall.sh --dry-run  print what would happen and change nothing
#
# Omarchy's remover disables the plugin, then deletes a git install or moves a
# hand-copied folder to a timestamped backup in ~/.config/omarchy/plugins.
# Running this when the plugin is not installed is a no-op.

set -euo pipefail

ID="io.github.terminalgravity.market-clock"
TARGET="$HOME/.config/omarchy/plugins/$ID"

DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
  --dry-run | -n) DRY_RUN=1 ;;
  -h | --help)
    sed -n '3,10p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
    exit 0
    ;;
  *)
    echo "uninstall.sh: unknown option: $arg" >&2
    exit 1
    ;;
  esac
done

if [[ ! -e $TARGET && ! -L $TARGET ]]; then
  echo "$ID is not installed; nothing to do."
  exit 0
fi

command -v omarchy-plugin-remove >/dev/null 2>&1 || {
  echo "uninstall.sh: omarchy-plugin-remove not found; remove $TARGET by hand." >&2
  exit 1
}

if ((DRY_RUN)); then
  printf 'would run: omarchy-plugin-remove %q --yes\n' "$ID"
else
  omarchy-plugin-remove "$ID" --yes
fi
