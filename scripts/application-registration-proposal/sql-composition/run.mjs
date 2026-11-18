import { access, mkdtemp, mkdir, readFile, realpath, rm } from "node:fs/promises";
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
