import assert from "node:assert/strict";
import { captureAdmissionFailure } from "./captureAdmissionFailure.mjs";
import { join } from "node:path";
import { readJson } from "../pack-scheduler-workflow-fixture/readJson.mjs";
import { waitFor } from "../pack-scheduler-workflow-fixture/waitFor.mjs";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
export async function runScenario(root, here, temp, scenario, { resumeTimeoutMs = 60000 } = {}) {
  const effects = join(temp, scenario);
  await mkdir(effects);
  await writeFile(join(effects, "events.jsonl"), "");
  await writeFile(
    join(effects, "state.json"),
    JSON.stringify({
      scenario,
      savedRunId:
        scenario === "immediate" ? "current" : scenario === "different-run" ? "other-run" : null,
      holdExpiresAt: new Date(
        scenario === "expired-hold"
          ? 0
          : Date.now() + (scenario === "hold-expiry" ? 10000 : 120000),
      ).toISOString(),
    }),
  );
  let child;
  try {
    const launch = phase => {
      const c = spawn(
        process.execPath,
        [
          "--import",
          join(here, "installAdmissionObserver.mjs"),
          join(here, "run.mjs"),
          "worker",
          temp,
          scenario,
          phase,
        ],
        {
          cwd: root,
          stdio: ["ignore", "pipe", "pipe", "ipc"],
        },
      );
      c.stdout.on("data", bytes => process.stdout.write(bytes));
      c.stderr.on("data", bytes => process.stderr.write(bytes));
      return c;
    };
    child = launch("start");
    await waitFor(async () => {
      if (child.exitCode !== null || child.signalCode !== null)
        throw new Error(`Fixture child exited ${child.exitCode ?? child.signalCode}`);
      try {
        await readJson(join(effects, "ready.json"));
        return true;
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
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
    if (scenario === "delayed") {
      const state = await readJson(join(effects, "state.json"));
      const { runId } = await readJson(join(effects, "run.json"));
      // Simulate the original dispatcher persisting its returned ID, never another start.
      await writeFile(join(effects, "state.json"), JSON.stringify({ ...state, savedRunId: runId }));
    }
    child = launch("resume");
    await waitFor(
      async () => child.exitCode !== null || child.signalCode !== null,
      resumeTimeoutMs,
    );
    assert.equal(child.exitCode, 0);
    child = undefined;
    const result = await readJson(join(effects, "result.json"));
    return {
      ...result,
      startNetworkAttempts: startReceipt.networkAttempts,
      resumeNetworkAttempts: result.networkAttempts,
    };
  } catch (error) {
    try {
      await captureAdmissionFailure(child, effects, error);
    } catch (captureError) {
      console.error("PACK_ADMISSION_CAPTURE_UNAVAILABLE", captureError.message);
    }
    throw error;
  } finally {
    if (child && child.exitCode === null && child.signalCode === null) {
      const exited = new Promise(resolve => child.once("exit", resolve));
      child.kill("SIGKILL");
      await exited;
    }
  }
}
