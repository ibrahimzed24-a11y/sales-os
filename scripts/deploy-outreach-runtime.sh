#!/bin/bash
# Mirror the sender into Application Support. launchd cannot read ~/Documents
# (macOS TCC), so the scheduled copy lives outside it. The tracker is a
# hardlink: writes made by the sender land in the repo file too.
set -eu
SRC="/Users/up_2/Documents/Default Project/sales-os-email-workflow"
RUNTIME="$HOME/Library/Application Support/Valioz/outreach-runtime"
mkdir -p "$RUNTIME/scripts" "$RUNTIME/dist/outreach-queue"

cp "$SRC/scripts/send-outreach.py" "$RUNTIME/scripts/send-outreach.py"
cp "$SRC/scripts/run-outreach.sh" "$RUNTIME/scripts/run-outreach.sh"
chmod +x "$RUNTIME/scripts/run-outreach.sh"

# The tracker must be the same inode as the repo file. ln -f replaces any old
# runtime copy, so never cp this one.
ln -f "$SRC/canadian_clinics_outreach_tracker.csv" "$RUNTIME/canadian_clinics_outreach_tracker.csv"

# Queue HTML/manifests are read-only for the sender; copies are fine.
rm -rf "$RUNTIME/dist/outreach-queue"
mkdir -p "$RUNTIME/dist/outreach-queue"
for day in "$SRC"/dist/outreach-queue/*/; do
  [ -f "$day/manifest.json" ] || continue
  cp -R "${day%/}" "$RUNTIME/dist/outreach-queue/"
done

echo "runtime: $RUNTIME"
echo "tracker inode: $(stat -f %i "$SRC/canadian_clinics_outreach_tracker.csv") = $(stat -f %i "$RUNTIME/canadian_clinics_outreach_tracker.csv")"
