#!/usr/bin/env bash
# Rebuild the sandbox base snapshot referenced by
# lib/sandbox/defaultBaseSnapshotId.ts.
#
# Run this from a machine logged into the Recoup Vercel team, then paste the
# printed snapshot id into DEFAULT_SANDBOX_BASE_SNAPSHOT_ID (or set
# VERCEL_SANDBOX_BASE_SNAPSHOT_ID to roll forward without a deploy).
#
# The base is Amazon Linux 2023, whose default repos carry neither ffmpeg nor
# chromium. ffmpeg therefore comes from a static build rather than dnf.
set -euo pipefail

echo "1. Provision a clean sandbox and note its id:"
echo "     vercel sandbox create --runtime node22 --timeout 30m"
echo
echo "2. Inside it, run:"
cat <<'INNER'
     sudo dnf install -y jq tar xz
     curl -fsSL https://bun.sh/install | sudo BUN_INSTALL=/usr/local bash
     sudo npm install -g agent-browser
     curl -fsSL https://code-server.dev/install.sh | sudo sh

     # ffmpeg — static build; Amazon Linux 2023 has no ffmpeg package.
     curl -fsSL -o /tmp/ffmpeg.tar.xz \
       https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz
     tar -xJf /tmp/ffmpeg.tar.xz -C /tmp
     sudo install -m 0755 /tmp/ffmpeg-*-amd64-static/ffmpeg  /usr/local/bin/ffmpeg
     sudo install -m 0755 /tmp/ffmpeg-*-amd64-static/ffprobe /usr/local/bin/ffprobe
     rm -rf /tmp/ffmpeg.tar.xz /tmp/ffmpeg-*-amd64-static

     # Verify before snapshotting — a snapshot without these is worse than none.
     ffmpeg -version | head -1
     ffprobe -version | head -1
     jq --version && bun --version && agent-browser --version
INNER
echo
echo "3. Snapshot and stop it:"
echo "     vercel sandbox snapshot <sandbox-id> --stop"
echo
echo "4. Put the printed snap_... id into lib/sandbox/defaultBaseSnapshotId.ts"
