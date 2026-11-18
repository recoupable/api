import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { denyNetwork } from "../denyNetwork.mjs";
const networkAttempts = denyNetwork();
import { waitFor } from "../waitFor.mjs";
import { runScenario } from "../runScenario.mjs";

test("a hanging poll still reaches its deadline", { timeout: 1000 }, async () => {
  await assert.rejects(
    waitFor(() => new Promise(() => {}), 25),
    /deadline exceeded/,
  );
});
test("polls retain unexpected errors", async () => {
  const cause = new Error("journal read failed");
  await assert.rejects(
    waitFor(() => {
      throw cause;
    }),
    error => error === cause,
  );
  await waitFor(() => true);
});
test("an already signal-exited owned child does not hang cleanup", { timeout: 5000 }, async () => {
  const temp = await mkdtemp(join(tmpdir(), "pack-child-exit-"));
  try {
    await writeFile(
      join(temp, "run.mjs"),
      `import { denyNetwork } from ${JSON.stringify(new URL("../denyNetwork.mjs", import.meta.url).href)}; denyNetwork(); process.kill(process.pid, "SIGKILL");\n`,
    );
    await assert.rejects(
      runScenario(process.cwd(), temp, temp, "success"),
      /Fixture child exited SIGKILL/,
    );
  } finally {
    await rm(temp, { recursive: true, force: true });
    assert.equal(networkAttempts(), 0);
  }
});
