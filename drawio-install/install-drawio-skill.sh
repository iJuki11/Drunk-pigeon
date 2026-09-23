#!/usr/bin/env bash
# Install drawio-skill globally so every Hermes profile (orchestrator, coder, a2z-social-media, ...) sees it.
# Source is staged inside the Hermes Docker container at /tmp/drawio-skill.
# This script runs on your Mac, NOT inside the container.
set -euo pipefail

SRC="/tmp/drawio-skill/skills/drawio-skill"
GLOBAL_DIR="$HOME/.hermes/skills"
PROFILE_DIR="$HOME/.hermes/profiles/orchestrator/skills"

# ---- Sanity: source still exists in container ----
# We're running on the host, so /tmp/drawio-skill is whatever was bind-mounted.
# If empty, the container's clone didn't survive — re-clone on host:
if [ ! -d "$SRC" ]; then
  echo "[install-drawio-skill] /tmp/drawio-skill not on host (container-only mount)."
  echo "Re-cloning on host instead..."
  rm -rf /tmp/drawio-skill-host
  git clone --depth 1 https://github.com/Agents365-ai/drawio-skill /tmp/drawio-skill-host
  SRC="/tmp/drawio-skill-host/skills/drawio-skill"
fi

if [ ! -f "$SRC/SKILL.md" ]; then
  echo "[FAIL] SKILL.md not found at $SRC — clone is broken."
  exit 1
fi

# ---- Probe target ----
probe_writable() {
  local dir="$1"
  if [ -d "$dir" ] && [ ! -w "$dir" ]; then
    return 1
  fi
  mkdir -p "$dir" 2>/dev/null && [ -w "$dir" ] && echo "$dir" && return 0
  return 1
}

TARGET="$(probe_writable "$GLOBAL_DIR" || true)"

# ---- Install: prefer global, fall back to profile-scoped ----
if [ -n "$TARGET" ]; then
  echo "[install-drawio-skill] TARGET = $TARGET (global, all profiles will see it)"
else
  TARGET="$PROFILE_DIR"
  echo "[install-drawio-skill] ~/.hermes/skills/ is read-only mount on this host."
  echo "[install-drawio-skill] TARGET = $TARGET (orchestrator profile only)"
fi

if [ -d "$TARGET/drawio-skill" ]; then
  echo "[install-drawio-skill] Removing old install at $TARGET/drawio-skill"
  rm -rf "$TARGET/drawio-skill"
fi

cp -R "$SRC" "$TARGET/drawio-skill"
echo "[install-drawio-skill] Copied to $TARGET/drawio-skill"

# ---- Verify ----
if [ -f "$TARGET/drawio-skill/SKILL.md" ]; then
  echo "[install-drawio-skill] PASS — SKILL.md present at $TARGET/drawio-skill/SKILL.md"
else
  echo "[install-drawio-skill] FAIL — SKILL.md missing after copy"
  exit 2
fi

# ---- Diag (stdlib-only, won't fail install) ----
if command -v python3 >/dev/null 2>&1; then
  echo "[install-drawio-skill] Running diagramctl doctor..."
  python3 "$TARGET/drawio-skill/scripts/diagramctl.py" doctor || \
    echo "[install-drawio-skill] (doctor returned non-zero — skill is installed but python diag had a warning)"
else
  echo "[install-drawio-skill] python3 not in PATH — skipped diagramctl doctor"
fi

echo ""
echo "============================================================"
echo " Installed. Next steps:"
echo "   1. Make sure VS Code has the drawio extension:"
echo "      Extensions panel -> search 'hediet.vscode-drawio' -> Install"
echo "   2. Open any .drawio file in VS Code — it renders inline."
echo "============================================================"
