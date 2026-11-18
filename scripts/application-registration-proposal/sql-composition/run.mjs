import { access, mkdtemp, mkdir, readFile, readlink, lstat, realpath, rm } from "node:fs/promises";
import { constants } from "node:fs";
import { createHash } from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
const root = fileURLToPath(new URL("../../../", import.meta.url));
const here = fileURLToPath(new URL("./", import.meta.url));
const args = process.argv.slice(2);
const options = {};
const faultIndex = args.indexOf("--fault");
const fault = faultIndex === -1 ? undefined : args[faultIndex + 1];
if (faultIndex !== -1) {
  if (
    faultIndex !== 6 ||
    args.length !== 8 ||
    !["signal", "timeout", "worker-exit"].includes(fault)
  )
    throw new Error("Invalid explicit fault control");
  args.splice(6, 2);
}
if (args.length !== 6)
  throw new Error(
    "Require --database-root PATH --pg-bin PATH --python PATH; no DSN or ambient connection settings",
  );
for (let i = 0; i < args.length; i += 2) {
  if (!["--database-root", "--pg-bin", "--python"].includes(args[i]) || options[args[i]])
    throw new Error("Unknown or duplicate qualification option");
  options[args[i]] = await realpath(args[i + 1]);
}
const database = options["--database-root"];
const pg = options["--pg-bin"];
const python = options["--python"];
for (const executable of [
  python,
  ...["postgres", "pg_ctl", "psql", "initdb"].map(name => join(pg, name)),
])
  await access(executable, constants.X_OK);
const bindings = JSON.parse(await readFile(join(here, "source-bindings.json"), "utf8"));
for (const [base, entries] of [
  [root, bindings.apiInputs],
  [database, bindings.databaseInputs],
]) {
  for (const [path, expected] of Object.entries(entries)) {
    const digest = createHash("sha256")
      .update(await readFile(join(base, path)))
      .digest("hex");
    if (digest !== expected) throw new Error(`Composition source binding mismatch: ${path}`);
  }
}
const gitEnv = {
  PATH: "/usr/bin:/bin",
  HOME: "/nonexistent/registration-qualification",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_CONFIG_GLOBAL: "/dev/null",
};
// Bind tracked API source bytes, including transitive authentication imports.
// Only this reviewed eight-path qualification slice may differ from the accepted revision.
const apiRevision = bindings.acceptedApiComposition ?? bindings.apiMerge;
if (!/^[0-9a-f]{40}$/.test(apiRevision)) throw new Error("Exact API revision required");
const gitRead = args =>
  execFileSync("/usr/bin/git", ["-C", root, ...args], {
    env: gitEnv,
    encoding: "utf8",
    timeout: 5000,
    maxBuffer: 16 * 1024 * 1024,
  });
if (gitRead(["rev-parse", "--verify", `${apiRevision}^{commit}`]).trim() !== apiRevision)
  throw new Error("Bound API revision unavailable");
gitRead(["merge-base", "--is-ancestor", apiRevision, "HEAD"]);
const allowedChanges = new Set([
  "vitest.config.ts",
  ...[
    "README.md",
    "run.mjs",
    "qualification.test.ts",
    "source-bindings.json",
    "supervise.py",
    "socket-guard.mjs",
    "vitest.config.ts",
  ].map(name => `scripts/application-registration-proposal/sql-composition/${name}`),
]);
const committedChanges = gitRead([
  "diff-tree",
  "--no-commit-id",
  "--name-only",
  "-r",
  "-z",
  apiRevision,
  "HEAD",
])
  .split("\0")
  .filter(Boolean);
for (const path of committedChanges) {
  if (!allowedChanges.has(path)) throw new Error(`Unbound committed API change: ${path}`);
}
const entries = gitRead(["ls-tree", "-r", "-z", apiRevision]).split("\0").filter(Boolean);
const baselinePaths = new Set();
let trackedInputsVerified = 0;
const unreadEnvPaths = [];
for (const entry of entries) {
  const separator = entry.indexOf("\t");
  const [mode, type, oid] = entry.slice(0, separator).split(" ");
  const path = entry.slice(separator + 1);
  baselinePaths.add(path);
  if (allowedChanges.has(path)) continue;
  // Dotenv is disabled; never open environment-file contents, including the tracked example.
  if (/(?:^|\/)\.env(?:$|\.)/.test(path)) {
    unreadEnvPaths.push(path);
    continue;
  }
  if (type !== "blob" || !["100644", "100755", "120000"].includes(mode))
    throw new Error(`Unsupported bound API entry: ${path}`);
  const full = join(root, path);
  const stat = await lstat(full);
  const matchesType =
    mode === "120000"
      ? stat.isSymbolicLink()
      : stat.isFile() && Boolean(stat.mode & 0o111) === (mode === "100755");
  if (!matchesType) throw new Error(`Unbound API source type: ${path}`);
  const bytes =
    mode === "120000" ? await readlink(full, { encoding: "buffer" }) : await readFile(full);
  // Hash raw working-tree bytes as Git blobs: no index flags, stat cache or clean filters.
  const actual = createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
  if (actual !== oid) throw new Error(`Unbound API source change: ${path}`);
  trackedInputsVerified++;
}
const indexedPaths = gitRead(["ls-files", "--cached", "-z"]).split("\0").filter(Boolean);
const untrackedPaths = gitRead(["ls-files", "--others", "--exclude-standard", "-z"])
  .split("\0")
  .filter(Boolean);
const ignoredSources = gitRead([
  "ls-files",
  "--others",
  "--ignored",
  "--exclude-standard",
  "-z",
  "--",
  "lib",
  "app",
  "types",
  "scripts/application-registration-proposal",
])
  .split("\0")
  .filter(path => /\.(?:[cm]?[jt]sx?|json|py|sql)$/.test(path));
for (const path of [...indexedPaths, ...untrackedPaths, ...ignoredSources]) {
  if (!baselinePaths.has(path) && !allowedChanges.has(path))
    throw new Error(`Unbound API source change: ${path}`);
}
console.log(
  "API_SOURCE_SCOPE " +
    JSON.stringify({
      revision: apiRevision,
      trackedInputsVerified,
      unreadEnvPaths,
      allowedQualificationPaths: [...allowedChanges],
    }),
);
const databaseHead = execFileSync("/usr/bin/git", ["-C", database, "rev-parse", "HEAD"], {
  env: gitEnv,
  encoding: "utf8",
  timeout: 5000,
}).trim();
if (databaseHead !== bindings.databaseHead)
  throw new Error("Exact Database proposal head required");
console.log("Composition source bindings verified; no hosted target accepted");
const owned = await mkdtemp("/tmp/registration-composition-launch-");
await mkdir(join(owned, "home"));
const env = {
  HOME: join(owned, "home"),
  TMPDIR: owned,
  PATH: `${dirname(python)}:${dirname(process.execPath)}:/usr/bin:/bin`,
  LANG: "C",
  LC_ALL: "C",
  TZ: "UTC",
  PG_BIN: pg,
};
let requestedSignal;
const onInt = () => {
  requestedSignal = "SIGINT";
};
const onTerm = () => {
  requestedSignal = "SIGTERM";
};
process.on("SIGINT", onInt);
process.on("SIGTERM", onTerm);
let child;
let complete = false;
let code;
let error;
let interruptedAt;
const started = Date.now();
try {
  child = spawn(
    python,
    [
      "-I",
      join(here, "supervise.py"),
      "--database-root",
      database,
      "--node",
      process.execPath,
      ...(fault ? ["--fault", fault] : []),
    ],
    { cwd: root, env, stdio: "inherit", detached: true },
  );
  child.once("error", value => {
    error = value;
    complete = true;
  });
  child.once("exit", value => {
    code = value;
    complete = true;
  });
  while (!complete) {
    if ((requestedSignal || Date.now() - started > 210000) && !interruptedAt) {
      interruptedAt = Date.now();
      // The reviewed Python owner performs lease-bound worker/cluster cleanup.
      child.kill("SIGTERM");
    }
    if (interruptedAt && Date.now() - interruptedAt > 45000) {
      child.kill("SIGKILL");
      throw new Error(
        "Supervisor cleanup unconfirmed; preserve owned evidence and inspect its recorded lease",
      );
    }
    await delay(50);
  }
  if (error) throw error;
  process.exitCode = interruptedAt ? 1 : (code ?? 1);
  if (code === 0 && !interruptedAt) {
    await rm(owned, { recursive: true, force: true });
    console.log("Composition supervisor completed and launch home removed");
  } else console.error(`Failed/interrupted qualification; preserved launch home ${owned}`);
} finally {
  process.removeListener("SIGINT", onInt);
  process.removeListener("SIGTERM", onTerm);
  if (!complete) {
    process.exitCode = 1;
    console.error(`Unconfirmed supervisor exit; preserved ${owned}`);
  }
}
