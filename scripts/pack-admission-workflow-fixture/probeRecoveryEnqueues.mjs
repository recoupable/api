import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { mkdtemp, cp, rm, writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { observeAdmissionWorld } from "./observeAdmissionWorld.mjs";
import { denyNetwork } from "../pack-scheduler-workflow-fixture/denyNetwork.mjs";
const network = denyNetwork();
const require = createRequire(import.meta.url);
const core = require.resolve("@workflow/core");
const local = createRequire(core).resolve("@workflow/world-local");
const { createLocalWorld } = await import(pathToFileURL(local));
const { reenqueueRun } = await import("@workflow/core/runtime");
const root = await mkdtemp(join(tmpdir(), "admission-enqueue-probe-"));
const seedPath = join(root, "seed");
const seed = createLocalWorld({ dataDir: seedPath });
const cases = [];
try {
  await seed.start();
  const created = await seed.events.create(null, {
    eventType: "run_created",
    eventData: {
      deploymentId: "probe",
      workflowName: "workflow//./probe//probe",
      input: new Uint8Array(),
    },
  });
  const runId = created.run.runId;
  await seed.events.create(runId, { eventType: "run_started" });
  const seedBytes = await readFile(join(seedPath, "runs", `${runId}.json`));
  const seedSha256 = createHash("sha256").update(seedBytes).digest("hex");
  for (const kind of ["startup-only", "explicit-only", "startup-plus-explicit"]) {
    const dataDir = join(root, kind);
    await cp(seedPath, dataDir, { recursive: true });
    assert.deepEqual(await readFile(join(dataDir, "runs", `${runId}.json`)), seedBytes);
    const world = createLocalWorld({ dataDir });
    const observer = observeAdmissionWorld(world, { phase: kind });
    globalThis[Symbol.for("pack.admission.queue.observers")].set(dataDir, observer.observeQueue);
    const expected = kind === "startup-plus-explicit" ? 2 : 1;
    const deliveries = [];
    let release;
    const barrier = new Promise(resolve => {
      release = resolve;
    });
    let resolveDone, rejectDone;
    const done = new Promise((resolve, reject) => {
      resolveDone = resolve;
      rejectDone = reject;
    });
    const timer = setTimeout(() => {
      release();
      rejectDone(new Error("Bounded delivery barrier timed out"));
    }, 3000);
    world.registerHandler("__wkf_workflow_", async request => {
      deliveries.push({
        messageId: request.headers.get("x-vqs-message-id"),
        attempt: request.headers.get("x-vqs-message-attempt"),
      });
      if (deliveries.length === expected) release();
      await barrier;
      setImmediate(resolveDone);
      return Response.json({});
    });
    try {
      if (kind !== "explicit-only") await observer.source("world.start", () => world.start());
      if (kind !== "startup-only")
        await observer.source("explicit-reenqueue", () => reenqueueRun(world, runId));
      await done;
      assert.equal(deliveries.length, expected);
      assert.equal(new Set(deliveries.map(delivery => delivery.messageId)).size, expected);
      const operations = observer.snapshot();
      const enqueues = operations.entries.filter(
        entry => entry.operation === "queue" && entry.stage === "return",
      );
      assert.equal(enqueues.length, expected);
      assert.deepEqual(
        enqueues.map(entry => entry.output.messageId).sort(),
        deliveries.map(delivery => delivery.messageId).sort(),
      );
      cases.push({ kind, runId, seedSha256, deliveries, operations });
    } finally {
      clearTimeout(timer);
      release();
      await world.close();
    }
  }
  assert.equal(network(), 0);
  const sdkBindings = await Promise.all(
    [local, join(dirname(local), "queue.js"), join(dirname(core), "runtime/runs.js")].map(
      async path => ({
        path,
        sha256: createHash("sha256")
          .update(await readFile(path))
          .digest("hex"),
      }),
    ),
  );
  await writeFile(
    process.env.PACK_ADMISSION_PROBE_OUTPUT ?? "/tmp/pack-admission-enqueue-probe.json",
    JSON.stringify(
      {
        scope:
          "Actual SDK enqueue/recovery with bounded synthetic receiver; not generated workflow replay or historical failure attribution",
        sdkBindings,
        cases,
        networkAttempts: network(),
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS fixed-snapshot startup1 / explicit1 / startup-plus-explicit2 distinct queued deliveries",
  );
} finally {
  await seed.close();
  await rm(root, { recursive: true, force: true });
}
