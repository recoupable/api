/** Compile exact scheduler/steps and exercise only local durable journals; deny network. */
import assert from "node:assert/strict";
import { createRequire, syncBuiltinESMExports } from "node:module";
import { mkdtemp, realpath, mkdir, readFile, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
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
  throw new Error("Network forbidden in pack scheduler fixture");
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
const readJson = async file => JSON.parse(await readFile(file, "utf8"));
const events = async dir =>
  (await readFile(join(dir, "events.jsonl"), "utf8"))
    .trim()
    .split("\n")
    .filter(Boolean)
    .map(JSON.parse);
async function waitFor(test) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (await test()) return;
    await new Promise(r => setTimeout(r, 25));
  }
  throw new Error("Offline fixture deadline exceeded");
}

async function worker(temp, scenario, phase) {
  const effects = join(temp, scenario);
  process.env.PACK_SCHEDULER_EFFECTS = effects;
  const { createLocalWorld } = await import(
    pathToFileURL(createRequire(require.resolve("@workflow/core")).resolve("@workflow/world-local"))
  );
  const { setWorld, reenqueueRun } = await import("@workflow/core/runtime");
  const { start, getRun, resumeHook, getHookByToken } = await import("workflow/api");
  const world = createLocalWorld({ dataDir: join(effects, "journal") });
  setWorld(world);
  const steps = await import(pathToFileURL(join(temp, "generated/steps.cjs")));
  const workflows = await import(pathToFileURL(join(temp, "generated/workflows.cjs")));
  let deliveries = 0;
  let activeDeliveries = 0;
  world.registerHandler("__wkf_step_", steps.POST);
  world.registerHandler("__wkf_workflow_", async req => {
    activeDeliveries++;
    try {
      return await workflows.POST(req);
    } finally {
      deliveries++;
      activeDeliveries--;
    }
  });
  await world.start();
  const { packSchedulerFixture } = await import(pathToFileURL(join(temp, "generated/client.mjs")));
  const hook = id => `${scenario}:${id}`;
  async function waitHook(id) {
    await waitFor(async () => {
      try {
        return !!(await getHookByToken(hook(id)));
      } catch {
        return false;
      }
    });
  }
  let run;
  const keepAlive = setInterval(() => {}, 1000);
  try {
    if (phase === "start") {
      run = await start(packSchedulerFixture, [scenario, 2]);
      await writeFile(join(effects, "run.json"), JSON.stringify({ runId: run.runId }));
      await waitHook("asset-0");
      await waitHook("asset-1");
      await waitFor(
        async () =>
          activeDeliveries === 0 &&
          deliveries > 0 &&
          (await events(effects)).filter(e => e.action === "claim").length === 4,
      );
      const trace = await events(effects);
      assert.equal(trace.filter(e => e.action === "provider").length, 2);
      assert.equal(trace.filter(e => e.action === "shared-preparation").length, 1);
      assert.equal(trace.filter(e => e.action === "settle").length, 0);
      await writeFile(join(effects, "before-crash.json"), JSON.stringify(trace));
      assert.equal(networkAttempts, 0);
      await writeFile(
        join(effects, "ready.json"),
        JSON.stringify({ networkAttempts, pid: process.pid }),
      );
      await new Promise(() => {}); // parent SIGKILLs only this owned fixture worker
    }
    console.log(`RESUME ${scenario}: local world ready`);
    const saved = await readJson(join(effects, "run.json"));
    run = getRun(saved.runId);
    await reenqueueRun(world, saved.runId); // explicit local queue recovery, not hosted auto-recovery
    await waitFor(async () => deliveries > 0);
    console.log(`RESUME ${scenario}: replay delivered`);
    await waitHook("asset-0");
    await waitHook("asset-1");
    assert.deepEqual(await events(effects), await readJson(join(effects, "before-crash.json")));
    console.log(`RESUME ${scenario}: hooks recovered`);
    await resumeHook(hook("asset-0"), "continue");
    if (scenario === "claim-failure") {
      await waitFor(async () =>
        (await events(effects)).some(e => e.action === "claim" && e.data.asset_id === "asset-2"),
      );
      assert.equal((await events(effects)).filter(e => e.action === "settle").length, 0);
      await resumeHook(hook("asset-1"), "continue");
    } else {
      await waitFor(
        async () => (await events(effects)).filter(e => e.action === "provider").length === 3,
      );
      console.log(`RESUME ${scenario}: third asset ready`);
      assert.equal((await events(effects)).filter(e => e.action === "provider").length, 3);
      assert.equal((await events(effects)).filter(e => e.action === "settle").length, 0);
      await resumeHook(hook("asset-1"), "continue");
      await waitFor(
        async () => (await events(effects)).filter(e => e.action === "provider").length === 4,
      );
      await resumeHook(hook("asset-2"), "continue");
      assert.equal((await events(effects)).filter(e => e.action === "settle").length, 0);
      await resumeHook(hook("asset-3"), "continue");
    }
    console.log(`RESUME ${scenario}: awaiting terminal outcome`);
    let value;
    let failure;
    try {
      value = await run.returnValue;
    } catch (error) {
      failure = String(error);
    }
    const trace = await events(effects);
    const state = await readJson(join(effects, "state.json"));
    assert.equal(trace.filter(e => e.action === "shared-preparation").length, 1);
    assert.equal(state.job.held_credits, 100);
    assert.equal(state.assets[4].status, "completed");
    assert.deepEqual(state.assets[4].files, [
      { storage_key: "retained", content_type: "image/png", bytes: 10 },
    ]);
    assert(state.assets.every(a => a.attempt <= 1));
    assert.equal(
      new Set(trace.filter(e => e.action === "provider").map(e => e.data.assetId)).size,
      trace.filter(e => e.action === "provider").length,
    );
    if (scenario === "claim-failure") {
      assert(value.error);
      assert.equal(trace.filter(e => e.action === "provider").length, 2);
      assert.equal(state.assets[3].status, "pending");
    } else if (scenario === "success") {
      assert.deepEqual(value, { job_id: scenario });
      assert.equal(trace.filter(e => e.action === "provider").length, 4);
    }
    const before = deliveries;
    await reenqueueRun(world, saved.runId);
    await waitFor(async () => deliveries > before);
    assert.deepEqual(await events(effects), trace);
    assert.equal(networkAttempts, 0);
    const result = {
      scenario,
      runId: saved.runId,
      value,
      failure,
      settlements: state.settlements,
      networkAttempts,
      trace,
      state,
      replay: "no repeated effects after process restart or terminal replay",
    };
    await writeFile(join(effects, "result.json"), JSON.stringify(result, null, 2));
    assert.equal(state.settlements, 1);
    if (scenario === "settlement-failure")
      assert(failure, "Lost settlement must remain failed, not success");
  } finally {
    clearInterval(keepAlive);
    await world.close();
  }
}

async function main() {
  const temp = await realpath(await mkdtemp(join(tmpdir(), "pack-scheduler-workflow-")));
  const source = join(temp, "source");
  await mkdir(source);
  await symlink(join(root, "node_modules"), join(temp, "node_modules"), "dir");
  const bindings = [];
  const paths = { "@/*": [join(root, "*")] };
  async function copy(from, to) {
    const bytes = await readFile(join(root, from));
    await writeFile(join(source, to), bytes);
    bindings.push({ path: from, sha256: createHash("sha256").update(bytes).digest("hex") });
  }
  await copy("lib/content/packs/runBoundedPackProduction.ts", "runBoundedPackProduction.ts");
  for (const name of ["preparePackStep", "producePackAssetStep", "settleBoundedPackStep"])
    await copy(`app/workflows/packs/${name}.ts`, `${name}.ts`);
  for (const from of [
    "lib/content/packs/producePackAsset.ts",
    "lib/content/packs/buildPackAssetPrompt.ts",
    "pnpm-lock.yaml",
  ]) {
    bindings.push({
      path: from,
      sha256: createHash("sha256")
        .update(await readFile(join(root, from)))
        .digest("hex"),
    });
  }
  for (const name of ["workflow", "effects"])
    await writeFile(
      join(source, `${name}.ts`),
      await readFile(join(here, `source/${name}.ts.txt`)),
    );
  for (const name of [
    "@/lib/supabase/release_pack_jobs/runPackCommand",
    "@/lib/content/packs/preparePackProduction",
    "@/lib/content/packs/createPackProductionServices",
  ])
    paths[name] = [join(source, "effects.ts")];
  await writeFile(
    join(source, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: { target: "ES2022", module: "ESNext", moduleResolution: "bundler", paths },
    }),
  );
  const builders = createRequire(require.resolve("workflow/next"));
  const { StandaloneBuilder } = await import(pathToFileURL(builders.resolve("@workflow/builders")));
  const old = process.cwd();
  let child;
  try {
    process.chdir(source);
    await new StandaloneBuilder({
      buildTarget: "standalone",
      workingDir: source,
      projectRoot: source,
      dirs: ["."],
      stepsBundlePath: "../generated/steps.cjs",
      workflowsBundlePath: "../generated/workflows.cjs",
      webhookBundlePath: "../generated/webhook.cjs",
      clientBundlePath: join(temp, "generated/client.mjs"),
    }).build();
    process.chdir(old);
    const results = [];
    for (const scenario of ["success", "claim-failure", "settlement-failure"]) {
      const effects = join(temp, scenario);
      await mkdir(effects);
      const assets = Array.from({ length: 5 }, (_, i) => ({
        id: `asset-${i}`,
        job_id: scenario,
        kind: "quote_card",
        ordinal: i,
        status: i === 4 ? "completed" : "pending",
        attempt: 0,
        provider_state: {},
        files: i === 4 ? [{ storage_key: "retained", content_type: "image/png", bytes: 10 }] : [],
      }));
      await writeFile(join(effects, "events.jsonl"), "");
      await writeFile(
        join(effects, "state.json"),
        JSON.stringify({
          scenario,
          settlements: 0,
          assets,
          job: {
            id: scenario,
            owner_id: "fixture-owner",
            held_credits: 100,
            brief: {
              artist_name: "Fixture",
              song_title: "Song",
              constraints: [],
              audio_url: "https://fixture.invalid/audio",
            },
            deliverables: { video_seconds: 8 },
            production_context: {
              state: "complete",
              summary: "retained analysis",
              source_sha256: "a".repeat(64),
            },
          },
        }),
      );
      const launch = phase => {
        const c = spawn(
          process.execPath,
          [fileURLToPath(import.meta.url), "worker", temp, scenario, phase],
          { cwd: root, stdio: ["ignore", "pipe", "pipe"] },
        );
        c.stdout.on("data", bytes => process.stdout.write(bytes));
        c.stderr.on("data", bytes => process.stderr.write(bytes));
        return c;
      };
      child = launch("start");
      await waitFor(async () => {
        if (child.exitCode !== null) throw new Error(`Fixture child exited ${child.exitCode}`);
        try {
          await readJson(join(effects, "ready.json"));
          return true;
        } catch {
          return false;
        }
      });
      const startReceipt = await readJson(join(effects, "ready.json"));
      assert.equal(startReceipt.networkAttempts, 0);
      const killed = new Promise(resolve =>
        child.once("exit", (code, signal) => resolve({ code, signal })),
      );
      child.kill("SIGKILL");
      assert.equal((await killed).signal, "SIGKILL");
      child = undefined;
      child = launch("resume");
      await waitFor(async () => child.exitCode !== null);
      assert.equal(child.exitCode, 0);
      child = undefined;
      const result = await readJson(join(effects, "result.json"));
      results.push({
        ...result,
        startNetworkAttempts: startReceipt.networkAttempts,
        resumeNetworkAttempts: result.networkAttempts,
      });
      console.log(
        `PASS ${scenario}: process restart, journal replay, ${result.settlements} settlement attempt(s)`,
      );
    }
    assert.equal(networkAttempts, 0);
    const output = {
      bindings,
      networkAttempts,
      results,
      limits:
        "Local compiled scheduler with actual steps, synthetic effects and explicit reenqueue after owned child SIGKILL at persisted hook boundary. No automatic hosted queue recovery, SQL enforcement, live provider or mid-provider crash proof.",
    };
    if (process.env.PACK_SCHEDULER_OUTPUT)
      await writeFile(process.env.PACK_SCHEDULER_OUTPUT, JSON.stringify(output, null, 2));
    assert(
      results.every(r => r.settlements === 1),
      "Settlement must not retry after a lost acknowledgement",
    );
  } finally {
    if (child && child.exitCode === null) {
      const exited = new Promise(resolve => child.once("exit", resolve));
      child.kill("SIGKILL");
      await exited;
    }
    process.chdir(old);
    await rm(temp, { recursive: true, force: true });
  }
}
if (process.argv[2] === "worker") await worker(process.argv[3], process.argv[4], process.argv[5]);
else await main();
