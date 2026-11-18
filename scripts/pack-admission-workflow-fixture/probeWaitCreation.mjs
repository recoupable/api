import assert from "node:assert/strict";
import { createRequire, registerHooks } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { observeAdmissionWorld } from "./observeAdmissionWorld.mjs";
import { readAdmissionJournal } from "./readAdmissionJournal.mjs";
import { denyAdmissionNetwork } from "./denyAdmissionNetwork.mjs";
const network = denyAdmissionNetwork();
const require = createRequire(import.meta.url);
const local = createRequire(require.resolve("@workflow/core")).resolve("@workflow/world-local");
const fsUrl = pathToFileURL(join(dirname(local), "fs.js")).href;
const fsHash = "7e754ee442b71cc09281c5646fb44f5034e3642f4f65383b3b93db1ccbea34f6";
const gateKey = Symbol.for("pack.admission.probe.after-absent-check");
const needle = "    const tempPath = `${filePath}.tmp.${ulid()}`;";
const insertion = `    if (globalThis[Symbol.for("pack.admission.probe.after-absent-check")])
        await globalThis[Symbol.for("pack.admission.probe.after-absent-check")](filePath, Boolean(opts?.overwrite));\n`;
registerHooks({
  load(url, context, nextLoad) {
    const loaded = nextLoad(url, context);
    if (url !== fsUrl) return loaded;
    const source = String(loaded.source);
    assert.equal(createHash("sha256").update(source).digest("hex"), fsHash);
    assert.equal(source.split(needle).length, 2);
    return { ...loaded, source: source.replace(needle, insertion + needle) };
  },
});
const { createLocalWorld } = await import(pathToFileURL(local));
const root = await mkdtemp(join(tmpdir(), "admission-storage-probe-"));
const cases = [];
try {
  for (const kind of [
    "serial",
    "same-correlation-same-wake",
    "different-correlations-same-wake",
    "same-correlation-conflicting-wake",
  ]) {
    const dataDir = join(root, kind);
    const world = createLocalWorld({ dataDir });
    const observer = observeAdmissionWorld(world, { phase: kind });
    await world.start();
    try {
      const created = await world.events.create(null, {
        eventType: "run_created",
        eventData: { deploymentId: "probe", workflowName: "probe", input: new Uint8Array() },
      });
      const runId = created.run.runId;
      await world.events.create(runId, { eventType: "run_started" });
      const wake = new Date(Date.now() + 60000);
      const inputs = [0, 1].map(i => ({
        eventType: "wait_created",
        correlationId:
          kind === "different-correlations-same-wake" ? `wait_probe_${i}` : "wait_probe",
        eventData: {
          resumeAt: new Date(
            wake.getTime() + (kind === "same-correlation-conflicting-wake" ? i : 0),
          ),
        },
      }));
      const absences = [];
      let release;
      const barrier = new Promise(resolve => {
        release = resolve;
      });
      let timeout;
      if (kind !== "serial") {
        timeout = setTimeout(() => release(), 2000);
        globalThis[gateKey] = async (filePath, overwrite) => {
          if (
            overwrite ||
            !inputs.some(
              input => filePath === join(dataDir, "waits", `${runId}-${input.correlationId}.json`),
            )
          )
            return;
          absences.push({ filePath, overwrite, stage: "actual-fs.access-observed-ENOENT" });
          if (absences.length === 2) release();
          await barrier;
        };
      }
      let results;
      try {
        if (kind === "serial") {
          const first = await world.events.create(runId, inputs[0]);
          results = [
            { status: "fulfilled", value: first },
            ...(await Promise.allSettled([world.events.create(runId, inputs[1])])),
          ];
        } else
          results = await Promise.allSettled(
            inputs.map(input => world.events.create(runId, input)),
          );
      } finally {
        clearTimeout(timeout);
        delete globalThis[gateKey];
      }
      const journal = await readAdmissionJournal(world, runId);
      const waits = journal.filter(event => event.eventType === "wait_created");
      if (kind === "serial") {
        assert.equal(results[1].status, "rejected");
        assert.equal(results[1].reason.name, "EntityConflictError");
        assert.equal(waits.length, 1);
      } else {
        assert.equal(absences.length, 2);
        assert(results.every(result => result.status === "fulfilled"));
        assert.equal(waits.length, 2);
        assert.notEqual(waits[0].eventId, waits[1].eventId);
      }
      const files = await Promise.all(
        [...new Set(inputs.map(input => input.correlationId))].map(async correlationId => ({
          correlationId,
          data: JSON.parse(
            await readFile(join(dataDir, "waits", `${runId}-${correlationId}.json`), "utf8"),
          ),
        })),
      );
      cases.push({
        kind,
        runId,
        absences,
        inputs,
        results: results.map(result =>
          result.status === "fulfilled"
            ? { status: result.status, eventId: result.value.event.eventId }
            : {
                status: result.status,
                error: { name: result.reason.name, message: result.reason.message },
              },
        ),
        journal,
        waitFiles: files,
        operations: observer.snapshot(),
      });
    } finally {
      await world.close();
    }
  }
  assert.equal(network(), 0);
  const receipt = {
    scope:
      "Deterministic installed SDK storage mechanism probe; not attribution of historical CI failure or production fencing",
    fsHash,
    seam: insertion,
    cases,
    networkAttempts: network(),
  };
  await writeFile(
    process.env.PACK_ADMISSION_PROBE_OUTPUT ?? "/tmp/pack-admission-storage-probe.json",
    JSON.stringify(receipt, null, 2),
  );
  console.log(
    "PASS serial conflict and three controlled absent-check overlaps; distinct stored event IDs retained",
  );
} finally {
  delete globalThis[gateKey];
  await rm(root, { recursive: true, force: true });
}
