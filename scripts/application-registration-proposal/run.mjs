import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { spawn, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
const root = fileURLToPath(new URL("../../", import.meta.url));
const temp = await mkdtemp("/tmp/registration-api-");
const inventoryEnv = {
  HOME: join(temp, "home"),
  TMPDIR: temp,
  PATH: "/usr/bin:/bin",
  LANG: "C",
  LC_ALL: "C",
  TZ: "UTC",
};
let child;
let stopped = false;
let requestedSignal;
let timer;
// The detached child owns a new process group; never signal the caller's group.
function signalOwned(signal) {
  if (!child?.pid) return;
  try {
    process.kill(-child.pid, signal);
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
}
function ownedAlive() {
  if (!child?.pid) return false;
  // A successful full process inventory is required; errors never mean absence.
  const output = execFileSync("/bin/ps", ["-axo", "pgid="], {
    encoding: "utf8",
    env: inventoryEnv,
    timeout: 1000,
    maxBuffer: 4 * 1024 * 1024,
  }).trim();
  if (!output || !/^\d+(?:\s+\d+)*$/.test(output)) throw new Error("Unconfirmed process inventory");
  return output.split(/\s+/).some(value => Number(value) === child.pid);
}
function interrupt(signal) {
  requestedSignal = signal;
}
const onInt = () => interrupt("SIGINT");
const onTerm = () => interrupt("SIGTERM");
process.on("SIGINT", onInt);
process.on("SIGTERM", onTerm);
try {
  await mkdir(join(temp, "home"));
  const env = {
    HOME: join(temp, "home"),
    TMPDIR: temp,
    PATH: `${dirname(process.execPath)}:/usr/bin:/bin`,
    LANG: "C",
    LC_ALL: "C",
    TZ: "UTC",
    NODE_ENV: "test",
    PRIVY_PROJECT_SECRET: "synthetic-registration-secret",
    PRIVY_APP_ID: "synthetic-app",
  };
  if (requestedSignal) throw new Error("Interrupted before launch");
  child = spawn(
    process.execPath,
    [
      "--import",
      join(root, "scripts/application-registration-proposal/denyNetwork.mjs"),
      join(root, "node_modules/vitest/vitest.mjs"),
      "run",
      "--config",
      "scripts/application-registration-proposal/vitest.proposal.config.ts",
    ],
    { cwd: root, env, stdio: "inherit", detached: true },
  );
  timer = setTimeout(() => interrupt("timeout"), 60000);
  // Polling also bounds a child that ignores TERM, and keeps signal handling active.
  let exited = false;
  let code;
  let spawnError;
  child.once("error", error => {
    spawnError = error;
    exited = true;
  });
  child.once("exit", value => {
    code = value;
    exited = true;
  });
  while (!exited && !requestedSignal) await delay(50);
  if (spawnError) throw spawnError;
  process.exitCode = requestedSignal ? 1 : (code ?? 1);
} finally {
  clearTimeout(timer);
  try {
    signalOwned("SIGTERM");
    for (let i = 0; i < 40 && ownedAlive(); i++) await delay(50);
    if (ownedAlive()) signalOwned("SIGKILL");
    for (let i = 0; i < 100 && ownedAlive(); i++) await delay(50);
    stopped = !ownedAlive();
    if (!stopped) throw new Error(`Owned processes remain; preserved ${temp}`);
    await rm(temp, { recursive: true, force: true });
    console.log(`Owned process group ${child?.pid ?? "not-started"} absent; removed ${temp}`);
  } finally {
    process.removeListener("SIGINT", onInt);
    process.removeListener("SIGTERM", onTerm);
    if (!stopped) {
      process.exitCode = 1;
      console.error(`Cleanup unconfirmed; preserved ${temp}`);
    }
  }
}
