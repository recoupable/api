/** Actual production orchestration, copied byte-for-byte; synthetic effect seams only. */
import assert from "node:assert/strict";
import { createRequire, syncBuiltinESMExports } from "node:module";
import {
  mkdtemp,
  realpath,
  mkdir,
  readFile,
  writeFile,
  symlink,
  rm,
  readdir,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import net from "node:net";
import tls from "node:tls";
import http from "node:http";
import https from "node:https";
const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
let networkAttempts = 0;
const deny = () => {
  networkAttempts++;
  throw new Error("Network forbidden in production workflow fixture");
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
const temp = await realpath(await mkdtemp(join(tmpdir(), "sites-repair-")));
const source = join(temp, "source");
await mkdir(source);
await symlink(join(root, "node_modules"), join(temp, "node_modules"), "dir");
const bindings = [];
async function copy(from, to) {
  const bytes = await readFile(join(root, from));
  await writeFile(join(source, to), bytes);
  bindings.push({ path: from, sha256: createHash("sha256").update(bytes).digest("hex") });
}
// The production orchestrator and repair loop are unchanged bytes. All external
// steps are synthetic; checkpoint timestamps are scripted, never global Date mocks.
for (const name of ["siteProductionWorkflow", "repairSiteProduction", "reviseStep"])
  await copy(`app/workflows/sites/${name}.ts`, `${name}.ts`);
const names = [
  "ensureSiteExistsStep",
  "albumMetadataStep",
  "revealBuildStep",
  "prepareSkillStep",
  "metadataStep",
  "audioSourceStep",
  "audioAnalysisStep",
  "enrichContextStep",
  "contextBriefStep",
  "selectConceptStep",
  "collectContextStep",
  "directionStep",
  "assetsStep",
  "buildStep",
  "reviewStep",
  "saveSiteStep",
  "readRepairCheckpointStep",
];
await writeFile(
  join(source, "effects.ts"),
  `
import {appendFileSync, readFileSync, existsSync} from "node:fs";
import {join} from "node:path";
import {RetryableError, FatalError} from "workflow";
const file = (name: string) => join(process.env.SITES_REPAIR_EFFECTS!,name);
export async function effect(name: string, args: any[]) {
  const scenario = JSON.parse(readFileSync(file("scenario.json"),"utf8"));
  const rows = readFileSync(file("events.jsonl"),"utf8").trim().split("\\n").filter(Boolean).map(x=>JSON.parse(x));
  const count = rows.filter(x=>x.name===name).length;
  appendFileSync(file("events.jsonl"),JSON.stringify({name,args})+"\\n");
  if(name==="readRepairCheckpointStep") {
    const late = scenario.name==="late-pass" && count>=3;
    if (scenario.name === "access-after-repair" && count >= 2) throw new FatalError("Synthetic access revoked");
    const stale = (scenario.name === "revision" && count >= 1) || (scenario.name === "revision-after-repair" && count >= 2);
    const deleted = (scenario.name === "deleted" && count >= 1) || (scenario.name === "deleted-after-repair" && count >= 2);
    return {now:late?1201000:1000, revision:stale?8:7, cancelled:deleted};
  }
  if(name==="buildStep") {
    if(scenario.name==="retry" && count===1) throw new RetryableError("synthetic interruption before repair result", {retryAfter: 1});
    if(scenario.name==="cancel" && count===1) while(!existsSync(file("release"))) await new Promise(r=>setTimeout(r,10));
    return {name:count?"repaired":"initial", assets:args[3]};
  }
  if(name==="reviewStep" && scenario.name==="direction-pass") return {verdict:"pass",issues:[{module:"direction",detail:"Wrong concept"}]};
  if(name==="reviewStep") return {verdict: count===0 || scenario.name==="exhaust" ? "revise":"pass", issues: count===0 || scenario.name==="exhaust" ? [{module:"implementation",severity:"blocking",detail:"Repair",fix:"Repair"}]:[]};
  if(name==="saveSiteStep") return {site:args[1]};
  if(name==="collectContextStep") return {release:{url:"https://example.com/release"}, marker:"original-context"};
  if(name==="prepareSkillStep") return {name:"synthetic",referenceIds:[]};
  if(name==="directionStep") return {concept:"original-concept",assets:[]};
  if(name==="assetsStep") return [{url:"https://example.com/asset",name:"original-asset"}];
  return {};
}
`,
);
for (const name of names)
  await writeFile(
    join(source, `${name}.ts`),
    `import {effect} from "./effects";
export async function ${name}(...args:any[]) {
  "use step";
  return effect("${name}",args);
}
`,
  );
await writeFile(
  join(source, "tsconfig.json"),
  JSON.stringify({
    compilerOptions: {
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "bundler",
      baseUrl: ".",
      paths: { "@/*": [join(root, "*")] },
    },
  }),
);
await writeFile(join(source, "package.json"), JSON.stringify({ type: "module" }));
let world;
const old = process.cwd();
try {
  process.chdir(source);
  const { StandaloneBuilder } = await import(
    pathToFileURL(createRequire(require.resolve("workflow/next")).resolve("@workflow/builders"))
  );
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
  const { createLocalWorld } = await import(
    pathToFileURL(createRequire(require.resolve("@workflow/core")).resolve("@workflow/world-local"))
  );
  const { setWorld, reenqueueRun } = await import("@workflow/core/runtime");
  const { start } = await import("workflow/api");
  const effects = join(temp, "effects");
  await mkdir(effects);
  process.env.SITES_REPAIR_EFFECTS = effects;
  world = createLocalWorld({ dataDir: join(temp, "journal") });
  setWorld(world);
  const steps = await import(pathToFileURL(join(temp, "generated/steps.cjs")));
  const workflows = await import(pathToFileURL(join(temp, "generated/workflows.cjs")));
  let deliveries = 0;
  world.registerHandler("__wkf_step_", steps.POST);
  world.registerHandler("__wkf_workflow_", async req => {
    const response = await workflows.POST(req);
    deliveries++;
    return response;
  });
  await world.start();
  const { siteProductionWorkflow } = await import(
    pathToFileURL(join(temp, "generated/client.mjs"))
  );
  const events = async () =>
    (await readFile(join(effects, "events.jsonl"), "utf8"))
      .trim()
      .split("\n")
      .filter(Boolean)
      .map(x => JSON.parse(x));
  async function until(predicate) {
    const deadline = Date.now() + 20000;
    while (!(await predicate())) {
      if (Date.now() > deadline) throw new Error("fixture timeout");
      await new Promise(r => setTimeout(r, 20));
    }
  }
  async function bounded(promise) {
    let timer;
    try {
      return await Promise.race([
        promise,
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error("fixture timeout")), 20000);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
  const traces = [];
  for (const name of [
    "success",
    "exhaust",
    "late-pass",
    "revision",
    "deleted",
    "retry",
    "cancel",
    "direction-pass",
    "revision-after-repair",
    "deleted-after-repair",
    "access-after-repair",
  ]) {
    await writeFile(join(effects, "events.jsonl"), "");
    await writeFile(join(effects, "scenario.json"), JSON.stringify({ name }));
    const run = await start(siteProductionWorkflow, [
      { id: "site", revision: 7, release_url: "https://example.com/release" },
      "Keep game",
      "account",
    ]);
    if (name === "cancel") {
      await until(async () => (await events()).filter(e => e.name === "buildStep").length === 2);
      await run.cancel();
      await writeFile(join(effects, "release"), "release");
      await assert.rejects(bounded(run.returnValue));
      assert.equal(await run.status, "cancelled");
    } else {
      const result = await bounded(run.returnValue);
      if (["success", "retry", "direction-pass"].includes(name))
        assert(result.site, JSON.stringify({ result, events: await events() }));
      else assert(result.error);
      if (name === "direction-pass") assert.equal(result.site.production.status, "needs-review");
    }
    const trace = await events();
    const count = n => trace.filter(e => e.name === n).length;
    assert.equal(
      count("saveSiteStep"),
      ["success", "retry", "direction-pass"].includes(name) ? 1 : 0,
    );
    assert.equal(
      count("buildStep"),
      name === "exhaust" || name === "retry"
        ? 3
        : ["revision", "deleted", "direction-pass"].includes(name)
          ? 1
          : 2,
    );
    assert.equal(
      count("reviewStep"),
      name === "exhaust"
        ? 3
        : [
              "revision",
              "deleted",
              "cancel",
              "direction-pass",
              "revision-after-repair",
              "deleted-after-repair",
              "access-after-repair",
            ].includes(name)
          ? 1
          : 2,
    );
    const builds = trace.filter(e => e.name === "buildStep");
    for (const b of builds.slice(1)) {
      assert.deepEqual(b.args[2], builds[0].args[2]);
      assert.deepEqual(b.args[3], builds[0].args[3]);
    }
    // Force a fresh workflow delivery after completion/cancellation: journaled
    // checkpoints and effects must not run again or reset attempt/deadline state.
    const before = deliveries;
    await reenqueueRun(world, run.runId);
    await until(() => deliveries > before);
    assert.deepEqual(await events(), trace);
    traces.push({ name, runId: run.runId, trace });
    console.log(`PASS compiled Sites workflow: ${name}`);
  }
  assert.equal(networkAttempts, 0);
  console.log(JSON.stringify({ bindings, traces, networkAttempts }, null, 2));
} finally {
  await world?.close();
  process.chdir(old);
  await rm(temp, { recursive: true, force: true });
}
