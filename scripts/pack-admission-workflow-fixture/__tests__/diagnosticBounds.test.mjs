import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { readAdmissionDiagnosticFile } from "../readAdmissionDiagnosticFile.mjs";
import { observeAdmissionWorld } from "../observeAdmissionWorld.mjs";
import { assertRecoveryTrace } from "../assertRecoveryTrace.mjs";
test("caps file reads before parsing and explicitly retains a partial line", async t => {
  const dir = await mkdtemp(join(tmpdir(), "admission-bounds-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const path = join(dir, "trace");
  await writeFile(path, '{"id":1}\n' + "x".repeat(10000));
  const capture = await readAdmissionDiagnosticFile(path, "jsonl", 32);
  assert.equal(capture.truncated, true);
  assert.equal(capture.bytesRead, 33);
  assert.deepEqual(capture.data[0], { id: 1 });
  assert(capture.data[1].incompleteRawLine.length <= 32);
  const json = await readAdmissionDiagnosticFile(path, "json", 32);
  assert.equal(json.truncated, true);
  assert.equal(json.data, undefined);
});
test("post-flush persistence errors prevent success qualification", async () => {
  const observer = observeAdmissionWorld(
    { registerHandler() {}, events: {} },
    { outputPath: "/dev/null/admission.jsonl" },
  );
  await observer.flush();
  const trace = observer.snapshot();
  assert.match(trace.persistenceError, /ENOTDIR/);
  assert.throws(() => assertRecoveryTrace(trace, "run"));
});
test("observer caps bytes and reports lost entries", async () => {
  const world = { registerHandler() {}, events: { create: async () => ({}) } };
  const observer = observeAdmissionWorld(world);
  await world.events.create("run", { correlationId: "x".repeat(2097153) });
  assert(observer.snapshot().droppedEntries > 0);
  assert.throws(() => assertRecoveryTrace(observer.snapshot(), "run"));
});
test("local guard rejects WebSocket, HTTP2 and shared transports before execution", () => {
  const guard = new URL("../denyAdmissionNetwork.mjs", import.meta.url).href;
  execFileSync(process.execPath, [
    "--input-type=module",
    "-e",
    `
    import assert from "node:assert/strict";
    import { connect } from "node:http2";
    import { denyAdmissionNetwork } from ${JSON.stringify(guard)};
    const count = denyAdmissionNetwork();
    assert.throws(() => new WebSocket("wss://example.invalid"), /Network forbidden/);
    assert.throws(() => connect("https://example.invalid"), /Network forbidden/);
    assert.throws(() => fetch("https://example.invalid"), /Network forbidden/);
    assert.equal(count(), 3);
  `,
  ]);
});

test("finalization waits for a failing close-generated last append and preserves primary errors", async t => {
  const { finalizeAdmissionWorld } = await import("../finalizeAdmissionWorld.mjs");
  t.mock.method(console, "error", () => {});
  for (const primary of [undefined, new Error("original operation failure")]) {
    let reached, fail;
    const lastWriteReached = new Promise(resolve => {
      reached = resolve;
    });
    const lastWrite = new Promise((_, reject) => {
      fail = reject;
    });
    const world = { registerHandler() {}, events: {} };
    const observer = observeAdmissionWorld(world, {
      outputPath: "controlled-log",
      writeLine: async (_path, line) => {
        const entry = JSON.parse(line);
        if (entry.operation === "close-generated" && entry.stage === "return") {
          reached();
          await lastWrite;
        }
      },
    });
    world.close = () => observer.source("close-generated", async () => {});
    let success = false;
    const finish = finalizeAdmissionWorld({ world, observer }, "run", primary).then(value => {
      success = true;
      return value;
    });
    const checked = assert.rejects(finish, error =>
      primary ? error === primary : error.code === "ERR_ASSERTION",
    );
    await lastWriteReached;
    assert.equal(success, false);
    fail(new Error("injected last append failure"));
    await checked;
    assert.equal(success, false, "no success qualification or receipt callback can run");
    assert.equal(observer.snapshot().persistenceError, "injected last append failure");
  }
});

test("start checkpoint rejects its last append before any ready receipt", async () => {
  const { drainAdmissionTrace } = await import("../drainAdmissionTrace.mjs");
  let reached, fail;
  const reachedLast = new Promise(resolve => {
    reached = resolve;
  });
  const last = new Promise((_, reject) => {
    fail = reject;
  });
  const observer = observeAdmissionWorld(
    { registerHandler() {}, events: {} },
    {
      outputPath: "controlled-start-log",
      writeLine: async (_path, line) => {
        if (
          JSON.parse(line).operation === "start-checkpoint" &&
          JSON.parse(line).stage === "return"
        ) {
          reached();
          await last;
        }
      },
    },
  );
  await observer.source("start-checkpoint", async () => {});
  let ready = false;
  const checkpoint = drainAdmissionTrace(observer).then(trace => {
    ready = true;
    return trace;
  });
  const rejected = assert.rejects(checkpoint, { code: "ERR_ASSERTION" });
  await reachedLast;
  assert.equal(ready, false);
  fail(new Error("late start append failure"));
  await rejected;
  assert.equal(ready, false);
});
