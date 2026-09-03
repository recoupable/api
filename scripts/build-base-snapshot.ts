/**
 * Rebuild the sandbox base snapshot referenced by
 * lib/sandbox/defaultBaseSnapshotId.ts, then print the new id.
 *
 * Restores the current base, layers ffmpeg/ffprobe on top (static build:
 * Amazon Linux 2023 carries no ffmpeg package), verifies every binary the
 * base promises, and only then snapshots. The snapshot never expires
 * (`expiration: 0`), unlike the org snapshots the workflow mints.
 *
 * Run from a checkout with the Recoup team credentials in the environment:
 *   env $(grep -E '^VERCEL_(TOKEN|TEAM_ID|PROJECT_ID)=' .env.local | xargs) \
 *     pnpm dlx tsx scripts/build-base-snapshot.ts
 * Then put the printed snap_... id into DEFAULT_SANDBOX_BASE_SNAPSHOT_ID.
 */
import { Sandbox } from "@vercel/sandbox";
import { DEFAULT_SANDBOX_BASE_SNAPSHOT_ID } from "../lib/sandbox/defaultBaseSnapshotId";

const FFMPEG_STATIC_URL =
  "https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz";

const INSTALL = [
  "sudo dnf install -y -q tar xz",
  `curl -fsSL -o /tmp/ffmpeg.tar.xz ${FFMPEG_STATIC_URL}`,
  "tar -xJf /tmp/ffmpeg.tar.xz -C /tmp",
  "sudo install -m 0755 /tmp/ffmpeg-*-amd64-static/ffmpeg /usr/local/bin/ffmpeg",
  "sudo install -m 0755 /tmp/ffmpeg-*-amd64-static/ffprobe /usr/local/bin/ffprobe",
  "rm -rf /tmp/ffmpeg.tar.xz /tmp/ffmpeg-*-amd64-static",
];

// A snapshot missing any of these is worse than no refresh at all.
const VERIFY = [
  "ffmpeg -version | head -1",
  "ffprobe -version | head -1",
  "jq --version",
  "bun --version",
  "agent-browser --version",
  "code-server --version | head -1",
  "node --version",
];

const credentials = {
  token: process.env.VERCEL_TOKEN!,
  teamId: process.env.VERCEL_TEAM_ID!,
  projectId: process.env.VERCEL_PROJECT_ID!,
};

async function main() {
  console.log(`Restoring base snapshot ${DEFAULT_SANDBOX_BASE_SNAPSHOT_ID}`);
  const sandbox = await Sandbox.create({
    source: { type: "snapshot", snapshotId: DEFAULT_SANDBOX_BASE_SNAPSHOT_ID },
    resources: { vcpus: 4 },
    timeout: 20 * 60_000,
    ...credentials,
  });
  try {
    for (const command of [...INSTALL, ...VERIFY]) {
      const result = await sandbox.runCommand("bash", ["-lc", command]);
      const stdout = (await result.stdout()).trim();
      const stderr = (await result.stderr()).trim();
      console.log(`$ ${command}\n${stdout}${stderr ? `\n${stderr}` : ""}`);
      if (result.exitCode !== 0) {
        throw new Error(`"${command}" exited ${result.exitCode}; not snapshotting.`);
      }
    }
    const snapshot = await sandbox.snapshot({ expiration: 0 });
    console.log(
      `\nNew base snapshot: ${snapshot.snapshotId} (expires: ${snapshot.expiresAt ?? "never"})`,
    );
  } finally {
    await sandbox.stop();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
