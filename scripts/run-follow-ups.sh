#!/usr/bin/env bash
# =============================================================================
# scripts/run-follow-ups.sh
#
# Production cron wrapper for the AgencyOS follow-up processor.
# This script is what Linux cron calls — it sets up the environment,
# manages logging with rotation, and runs the Node.js processor.
#
# Setup on VPS:
#   chmod +x /path/to/agencyos/scripts/run-follow-ups.sh
#   crontab -e
#   Add: */15 * * * * /path/to/agencyos/scripts/run-follow-ups.sh
# =============================================================================

set -euo pipefail

# ── Paths ─────────────────────────────────────────────────────────────────────
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="${APP_DIR}/logs/cron"
LOG_FILE="${LOG_DIR}/follow-ups.log"
MAX_LOG_DAYS=30

# ── Bootstrap ─────────────────────────────────────────────────────────────────
mkdir -p "${LOG_DIR}"

# ── Log rotation — keep last N days of logs ───────────────────────────────────
find "${LOG_DIR}" -name "follow-ups-*.log" -mtime +${MAX_LOG_DAYS} -delete 2>/dev/null || true

# Rotate current log at midnight (when a new day's first run fires)
TODAY=$(date +%Y-%m-%d)
DATED_LOG="${LOG_DIR}/follow-ups-${TODAY}.log"

# ── Load environment from .env.local ──────────────────────────────────────────
# Exports all KEY=VALUE lines (skips comments and blank lines)
ENV_FILE="${APP_DIR}/.env.local"
if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck source=/dev/null
  source <(grep -v '^\s*#' "${ENV_FILE}" | grep -v '^\s*$')
  set +a
fi

# Fallback: also load .env if present (lower precedence)
ENV_FILE_BASE="${APP_DIR}/.env"
if [[ -f "${ENV_FILE_BASE}" ]]; then
  set -a
  source <(grep -v '^\s*#' "${ENV_FILE_BASE}" | grep -v '^\s*$')
  set +a
fi

# ── Run the processor ─────────────────────────────────────────────────────────
{
  echo ""
  echo "════════════════════════════════════════════════════════"
  echo " Run started at $(date '+%Y-%m-%d %H:%M:%S %Z')"
  echo "════════════════════════════════════════════════════════"

  cd "${APP_DIR}"

  # Use npx tsx to run the TypeScript script directly (no build step needed)
  npx --yes tsx scripts/process-follow-ups.ts
  EXIT_CODE=$?

  echo "────────────────────────────────────────────────────────"
  echo " Exit code: ${EXIT_CODE} | Finished at $(date '+%Y-%m-%d %H:%M:%S %Z')"
  echo "────────────────────────────────────────────────────────"
} >> "${DATED_LOG}" 2>&1

# Also append to a rolling combined log for easy tail -f monitoring
cat "${DATED_LOG}" >> "${LOG_FILE}" 2>/dev/null || true

exit "${EXIT_CODE:-0}"
