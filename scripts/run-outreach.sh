#!/bin/bash
# Local scheduler entry point: launchd starts this Tue/Wed/Thu at 12:00 Cairo,
# the Python runner sleeps until each clinic's exact 08:00 local send time.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || exit 1
export PATH="/usr/bin:/bin:/usr/sbin:/sbin:/Users/up_2/.local/bin"
mkdir -p dist/outreach-queue
exec /usr/bin/caffeinate -i -s /Users/up_2/.local/bin/browser-harness \
  < scripts/send-outreach.py >> dist/outreach-queue/scheduler.log 2>&1
