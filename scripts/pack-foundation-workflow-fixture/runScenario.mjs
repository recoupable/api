import assert from "node:assert/strict";
import { join } from "node:path";
import { readJson } from "../pack-scheduler-workflow-fixture/readJson.mjs";
import { waitFor } from "../pack-scheduler-workflow-fixture/waitFor.mjs";
import { spawn } from "node:child_process";
import { initializeScenario } from "./initializeScenario.mjs";
export async function runScenario(root, here, temp, scenario) {
  const effects = join(temp, scenario);
  await initializeScenario(temp, effects, scenario);
  let child;
  try {
    const launch = phase => {
      const c = spawn(process.execPath, [join(here, "run.mjs"), "worker", temp, scenario, phase], {
        cwd: root,
        stdio: ["ignore", "pipe", "pipe"],
      });
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
    child = launch("resume");
    await waitFor(async () => child.exitCode !== null || child.signalCode !== null);
    assert.equal(child.exitCode, 0);
    child = undefined;
    const result = await readJson(join(effects, "result.json"));
    return {
      ...result,
      startNetworkAttempts: startReceipt.networkAttempts,
      resumeNetworkAttempts: result.networkAttempts,
    };
  } finally {
    if (child && child.exitCode === null && child.signalCode === null) {
      const exited = new Promise(resolve => child.once("exit", resolve));
      child.kill("SIGKILL");
      await exited;
    }
  }
}
