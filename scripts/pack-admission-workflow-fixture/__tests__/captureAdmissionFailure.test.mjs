import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runScenario } from "../runScenario.mjs";
import { readAdmissionJournal } from "../readAdmissionJournal.mjs";
for (const scenario of ["timeout", "signal", "decoder", "assertion"]) {
  test(`parent retains ${scenario} evidence and cleans up the owned child`, async t => {
    const root = await mkdtemp(join(tmpdir(), "admission-capture-test-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    await writeFile(join(root, "installAdmissionObserver.mjs"), "");
    await writeFile(
      join(root, "run.mjs"),
      `
      import { writeFile } from "node:fs/promises";
      import { join } from "node:path";
      const [, , , temp, scenario, phase] = process.argv;
      const dir = join(temp, scenario);
      const trace = { operationId: 1, stage: "call", delivery: { messageId: "real-child-message" } };
      await writeFile(join(dir, phase + "-world-trace.jsonl"), JSON.stringify(trace) + "\\n");
      if (phase === "start") {
        await writeFile(join(dir, "before-crash.json"), JSON.stringify([{stepId:"original"}]));
        await writeFile(join(dir, "ready.json"), JSON.stringify({ networkAttempts: 0 }));
      } else {
        await writeFile(join(dir, "child-pid"), String(process.pid));
        await writeFile(join(dir, "assertion-evidence.json"), JSON.stringify({ stage: scenario, journal: [{eventId:"retained-event"}] }));
        if (scenario === "signal") process.kill(process.pid, "SIGKILL");
        if (scenario === "decoder" || scenario === "assertion") process.exit(17);
      }
      process.on("message", message => process.send({ type: "admission-snapshot", requestId: message.requestId, evidence: { trace, pid: process.pid } }));
      setInterval(() => {}, 1000);
    `,
    );
    const output = [];
    t.mock.method(console, "error", (...args) => output.push(args));
    await assert.rejects(
      runScenario(root, root, root, scenario, { resumeTimeoutMs: 1000 }),
      error =>
        scenario === "timeout"
          ? error.message === "Offline fixture deadline exceeded"
          : error.code === "ERR_ASSERTION",
    );
    const record = output.find(args => args[0] === "PACK_ADMISSION_SAVED_FAILURE");
    assert(record);
    const evidence = JSON.parse(record[1]);
    assert.equal(evidence.saved.data.journal[0].eventId, "retained-event");
    assert.equal(evidence.resumeOperationTrace.data[0].delivery.messageId, "real-child-message");
    assert.equal(evidence["before-crash.json"].data[0].stepId, "original");
    if (scenario === "timeout")
      assert.equal(evidence.live.trace.delivery.messageId, "real-child-message");
    const pid = Number(await readFile(join(root, scenario, "child-pid"), "utf8"));
    assert.throws(() => process.kill(pid, 0), { code: "ESRCH" });
  });
}
test("contradictory same-ID pages fail, while identical duplicates remain visible", async () => {
  const first = { eventId: "same", correlationId: "one" };
  const world = {
    events: {
      list: async ({ pagination }) =>
        pagination.cursor
          ? { data: [first], hasMore: false }
          : { data: [first], cursor: "next", hasMore: true },
    },
  };
  assert.equal((await readAdmissionJournal(world, "run")).length, 2);
  world.events.list = async ({ pagination }) =>
    pagination.cursor
      ? { data: [{ ...first, correlationId: "other" }], hasMore: false }
      : { data: [first], cursor: "next", hasMore: true };
  await assert.rejects(readAdmissionJournal(world, "run"), /contradictory/);
});
