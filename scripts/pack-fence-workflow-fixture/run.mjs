/** Actual compiled production workflow/steps, synthetic effects, zero network. */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  mkdtemp,
  realpath,
  mkdir,
  readFile,
  writeFile,
  readdir,
  symlink,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { denyNetwork } from "../pack-scheduler-workflow-fixture/denyNetwork.mjs";
import { createFixtureWorld } from "../pack-scheduler-workflow-fixture/createFixtureWorld.mjs";
import { waitFor } from "../pack-scheduler-workflow-fixture/waitFor.mjs";
const require = createRequire(import.meta.url),
  here = dirname(fileURLToPath(import.meta.url)),
  root = resolve(here, "../..");
const network = denyNetwork(),
  temp = await realpath(await mkdtemp(join(tmpdir(), "pack-fence-sdk-"))),
  bindings = [];
const source = join(temp, "source");
await mkdir(source);
await symlink(join(root, "node_modules"), join(temp, "node_modules"), "dir");
const paths = { "@/*": [join(root, "*")] };
try {
  for (const name of [
    "preparePackStep",
    "producePackAssetStep",
    "settlePackStep",
    "settleBoundedPackStep",
    "releasePackWorkflow",
  ]) {
    const path = `app/workflows/packs/${name}.ts`,
      bytes = await readFile(join(root, path));
    bindings.push({ path, sha256: createHash("sha256").update(bytes).digest("hex") });
    await writeFile(
      join(source, name === "releasePackWorkflow" ? "workflow.ts" : `${name}.ts`),
      name === "releasePackWorkflow"
        ? bytes
            .toString()
            .replace("function releasePackWorkflow(", "function packSchedulerFixture(")
        : bytes,
    );
  }
  for (const file of await readdir(join(here, "source"))) {
    const bytes = await readFile(join(here, "source", file));
    bindings.push({
      path: `scripts/pack-fence-workflow-fixture/source/${file}`,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
    await writeFile(join(source, file.slice(0, -4)), bytes);
  }
  for (const path of [
    "pnpm-lock.yaml",
    "scripts/pack-fence-workflow-fixture/run.mjs",
    "scripts/pack-scheduler-workflow-fixture/createFixtureWorld.mjs",
    "scripts/pack-scheduler-workflow-fixture/denyNetwork.mjs",
    "scripts/pack-scheduler-workflow-fixture/waitFor.mjs",
    ...(await readdir(join(root, "lib/content/packs/fence")))
      .filter(name => name.endsWith(".ts"))
      .map(name => `lib/content/packs/fence/${name}`),
  ]) {
    const bytes = await readFile(join(root, path));
    bindings.push({ path, sha256: createHash("sha256").update(bytes).digest("hex") });
  }
  for (const module of [
    "@/lib/supabase/release_pack_jobs/runPackCommand",
    "@/lib/content/packs/preparePackProduction",
    "@/lib/content/packs/createPackProductionServices",
  ])
    paths[module] = [join(source, module.split("/").at(-1) + ".ts")];
  await writeFile(
    join(source, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: { target: "ES2022", module: "ESNext", moduleResolution: "bundler", paths },
    }),
  );
  const builders = createRequire(require.resolve("workflow/next"));
  const { StandaloneBuilder } = await import(pathToFileURL(builders.resolve("@workflow/builders")));
  const old = process.cwd();
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
  } finally {
    process.chdir(old);
  }
  const results = [];
  for (const scenario of ["phase-failure", "settlement-failure"]) {
    const effects = join(temp, scenario);
    await mkdir(effects);
    const jobId = "00000000-0000-4000-8000-000000000001",
      executionId = "00000000-0000-4000-8000-000000000002";
    const job = {
      id: jobId,
      owner_id: "fixture",
      created_by: "fixture",
      revision: 1,
      protocol: 2,
      execution_id: executionId,
      execution_version: 1,
      status: "running",
      held_credits: 100,
      consumed_credits: 0,
      workflow_run_id: null,
      error: null,
      quote: null,
      brief: {
        artist_name: "Fixture",
        song_title: "Fixture",
        primary_action: "listen",
        allow_creative_defaults: false,
        reference_image_urls: [],
        platforms: ["instagram"],
        evidence: [],
        constraints: [],
        audio_url: "https://example.invalid/synthetic",
      },
      deliverables: {
        videos: 0,
        quote_cards: 1,
        artwork: 0,
        carousels: 0,
        visualizers: 0,
        video_seconds: 8,
      },
    };
    await writeFile(
      join(effects, "state.json"),
      JSON.stringify({
        scenario,
        settlements: 0,
        job,
        assets: [
          {
            id: "asset-0",
            job_id: jobId,
            kind: "quote_card",
            ordinal: 0,
            status: "pending",
            attempt: 0,
            provider_state: {},
            files: [],
            caption: null,
            qa: null,
            error: null,
            credits: 100,
            maximum_usd: 0.01,
          },
        ],
      }),
    );
    await writeFile(join(effects, "events.jsonl"), "");
    const ctx = await createFixtureWorld(temp, effects),
      keepAlive = setInterval(() => {}, 1000);
    try {
      const run = await ctx.start(ctx.packSchedulerFixture, [
        { accountId: "fixture", packProtocol: 2 },
        jobId,
        undefined,
        { expected_revision: 1, execution_id: executionId, execution_version: 1 },
      ]);
      let failure;
      await waitFor(async () => {
        try {
          await run.returnValue;
        } catch (error) {
          failure = String(error);
          return true;
        }
        return false;
      }, 60000);
      await waitFor(() => ctx.counts().activeDeliveries === 0);
      const trace = (await readFile(join(effects, "events.jsonl"), "utf8"))
        .trim()
        .split("\n")
        .filter(Boolean)
        .map(JSON.parse);
      assert(failure);
      assert.equal(
        trace.filter(x => x.action === "settle").length,
        scenario === "phase-failure" ? 0 : 1,
      );
      if (scenario === "phase-failure")
        assert.equal(trace.filter(x => x.action === "finish_asset").length, 0);
      const before = JSON.stringify(trace),
        delivered = ctx.counts().deliveries;
      await ctx.reenqueueRun(ctx.world, run.runId);
      await waitFor(() => ctx.counts().deliveries > delivered);
      const after = (await readFile(join(effects, "events.jsonl"), "utf8"))
        .trim()
        .split("\n")
        .filter(Boolean)
        .map(JSON.parse);
      assert.equal(JSON.stringify(after), before);
      const events = await ctx.world.events.list({ runId: run.runId });
      assert(events.data.some(x => x.eventType === "step_failed"));
      results.push({
        scenario,
        failure,
        trace,
        stepFailures: events.data.filter(x => x.eventType === "step_failed"),
        terminalReplay: "no repeated effects",
      });
      console.log(
        `PASS ${scenario}: ${trace.filter(x => x.action === "settle").length} settlement call(s)`,
      );
    } finally {
      clearInterval(keepAlive);
      await ctx.world.close();
    }
  }
  assert.equal(network(), 0);
  if (process.env.PACK_FENCE_SDK_OUTPUT)
    await writeFile(
      process.env.PACK_FENCE_SDK_OUTPUT,
      JSON.stringify(
        {
          bindings,
          results,
          networkAttempts: network(),
          boundary:
            "actual compiled release workflow body (export renamed only), actual steps; synthetic persistence/effect leaves, not SQL or hosted qualification",
        },
        null,
        2,
      ),
    );
} finally {
  await rm(temp, { recursive: true, force: true });
}
