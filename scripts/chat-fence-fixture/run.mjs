/** Compile and execute only synthetic local workflows; deny every network transport. */
import assert from "node:assert/strict";
import { createRequire, syncBuiltinESMExports } from "node:module";
import {
  mkdtemp,
  realpath,
  readFile,
  readdir,
  writeFile,
  symlink,
  rm,
  mkdir,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import net from "node:net";
import tls from "node:tls";
import http from "node:http";
import https from "node:https";
const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
let networkAttempts = 0;
const deny = () => {
  networkAttempts++;
  throw new Error("Network forbidden in offline chat-fence fixture");
};
globalThis.fetch = deny;
net.connect = deny;
net.createConnection = deny;
net.Socket.prototype.connect = deny;
tls.connect = deny;
http.request = deny;
http.get = deny;
https.request = deny;
https.get = deny;
syncBuiltinESMExports();
process.env.WORKFLOW_TELEMETRY_DISABLED = "1";
process.env.DO_NOT_TRACK = "1";
const temp = await realpath(await mkdtemp(join(tmpdir(), "chat-fence-compiled-")));
const fixture = join(temp, "source");
await mkdir(fixture);
await symlink(join(root, "node_modules"), join(temp, "node_modules"), "dir");
await writeFile(
  join(fixture, "tsconfig.json"),
  JSON.stringify({
    compilerOptions: {
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "bundler",
      paths: { "@/*": [join(root, "*")] },
    },
  }),
);
for (const name of await readdir(join(here, "source"))) {
  if (name.endsWith(".ts.txt"))
    await writeFile(join(fixture, name.slice(0, -4)), await readFile(join(here, "source", name)));
}
const builders = createRequire(require.resolve("workflow/next"));
const { StandaloneBuilder } = await import(pathToFileURL(builders.resolve("@workflow/builders")));
let world;
const originalCwd = process.cwd();
process.chdir(fixture);
try {
  await new StandaloneBuilder({
    buildTarget: "standalone",
    workingDir: fixture,
    projectRoot: fixture,
    dirs: ["."],
    stepsBundlePath: "../generated/steps.cjs",
    workflowsBundlePath: "../generated/workflows.cjs",
    webhookBundlePath: "../generated/webhook.cjs",
    clientBundlePath: join(temp, "generated/client.mjs"),
  }).build();
  const { createLocalWorld } = await import(
    pathToFileURL(createRequire(require.resolve("@workflow/core")).resolve("@workflow/world-local"))
  );
  const { setWorld, reenqueueRun } = await import("@workflow/core/runtime");
  const { start, resumeHook, getHookByToken } = await import("workflow/api");
  const effects = join(temp, "effects");
  await mkdir(effects);
  process.env.CHAT_FENCE_FIXTURE_DIR = effects;
  world = createLocalWorld({ dataDir: join(temp, "journal") });
  setWorld(world);
  const steps = await import(pathToFileURL(join(temp, "generated/steps.cjs")));
  const workflows = await import(pathToFileURL(join(temp, "generated/workflows.cjs")));
  world.registerHandler("__wkf_step_", steps.POST);
  let workflowDeliveries = 0;
  world.registerHandler("__wkf_workflow_", async req => {
    workflowDeliveries++;
    return workflows.POST(req);
  });
  await world.start();
  const { fenceFixture } = await import(pathToFileURL(join(temp, "generated/client.mjs")));
  const authority = {
    chatId: "synthetic-chat",
    effectiveAccount: "11111111-1111-4111-8111-111111111111",
    epoch: 7,
    owner: "22222222-2222-4222-8222-222222222222",
  };
  const events = async () =>
    (await readFile(join(effects, "events.jsonl"), "utf8"))
      .trim()
      .split("\n")
      .filter(Boolean)
      .map(line => JSON.parse(line));
  const waitFor = async predicate => {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      if (await predicate()) return;
      await new Promise(r => setTimeout(r, 20));
    }
    throw new Error("Offline fixture deadline exceeded");
  };
  const bounded = async promise => {
    let timer;
    try {
      return await Promise.race([
        promise,
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new Error("Local workflow completion deadline exceeded")),
            15000,
          );
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  };
  const waitHook = async token =>
    waitFor(async () => {
      try {
        return !!(await getHookByToken(token));
      } catch {
        return false;
      }
    });
  const first = await start(fenceFixture, [{ authority, hookToken: "fixture-winner" }]);
  await waitHook("fixture-winner");
  assert.deepEqual(
    (await events()).map(e => e.action),
    ["bind"],
  );
  const beforeReplay = workflowDeliveries;
  await reenqueueRun(world, first.runId);
  await waitFor(async () => workflowDeliveries > beforeReplay);
  // A second local workflow competes for the same synthetic binding while winner is suspended.
  const loser = await start(fenceFixture, [{ authority, hookToken: "fixture-loser" }]);
  assert.deepEqual(await bounded(loser.returnValue), { outcome: "lost", runId: loser.runId });
  assert.deepEqual(
    (await events()).filter(e => e.runId === loser.runId).map(e => e.action),
    ["lost"],
  );
  assert.deepEqual(
    (await events()).filter(e => e.runId === first.runId).map(e => e.action),
    ["bind"],
  );
  await resumeHook("fixture-winner", "go");
  assert.deepEqual(await bounded(first.returnValue), { outcome: "complete", runId: first.runId });
  const firstEvents = (await events()).filter(e => e.runId === first.runId);
  assert.deepEqual(
    firstEvents.map(e => e.action),
    ["bind", "user", "provider", "release", "key-cleanup"],
  );
  for (const event of firstEvents) assert.deepEqual(event.authority, authority);
  const failed = await start(fenceFixture, [
    {
      authority: { ...authority, owner: "33333333-3333-4333-8333-333333333333" },
      hookToken: "fixture-failed-write",
      failWrite: true,
    },
  ]);
  await waitHook("fixture-failed-write");
  await resumeHook("fixture-failed-write", "go");
  await assert.rejects(bounded(failed.returnValue), /Required user write failed/);
  assert.deepEqual(
    (await events()).filter(e => e.runId === failed.runId).map(e => e.action),
    ["bind", "key-cleanup"],
  );
  assert.equal(networkAttempts, 0);
  console.log(
    JSON.stringify(
      {
        result: "PASS",
        compiled: true,
        localJournalReplay: true,
        originalRunId: first.runId,
        loserRunId: loser.runId,
        firstEvents,
        workflowDeliveries,
        networkAttempts,
        limits:
          "Synthetic bind/write/provider effects; no SQL, hosted start, cancellation, or production workflow integration.",
      },
      null,
      2,
    ),
  );
} finally {
  await world?.close();
  process.chdir(originalCwd);
  await rm(temp, { recursive: true, force: true });
}
