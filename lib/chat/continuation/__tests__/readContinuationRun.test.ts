import { createRequire } from "node:module";
import { expect, it, vi } from "vitest";
import { readContinuationRun } from "../readContinuationRun";
import { gateStoredContinuation } from "../gateStoredContinuation";
import { CONTINUATION_WORKFLOW } from "../streamProtocol";
const require = createRequire(import.meta.url);
const { stringify } = createRequire(require.resolve("@workflow/core/serialization-format"))(
  "devalue",
);
const { getWorld } = vi.hoisted(() => ({ getWorld: vi.fn() }));
vi.mock("workflow/runtime", () => ({ getWorld }));
const scope = { runId: "run", accountId: "account", chatId: "chat", sessionId: "session" };
const input = [
  {
    accountId: "account",
    chatId: "chat",
    sessionId: "session",
    messages: [],
    modelId: "model",
    agentContext: {},
    streamProtocol: "canonical-base-v1",
  },
];
function fixture(data: unknown = input) {
  const world = {
    runs: {
      get: vi.fn(async () => ({
        runId: "run",
        workflowName: CONTINUATION_WORKFLOW,
        input:
          data instanceof Uint8Array ? data : new TextEncoder().encode("devl" + stringify(data)),
      })),
    },
    getEncryptionKeyForRun: vi.fn(async () => undefined),
  };
  getWorld.mockReturnValue(world);
  return world;
}
it("uses exact configured run read and existing hydration without stream access", async () => {
  const world = fixture(new TextEncoder().encode('devl[[1],{"chatId":2},"chat"]'));
  const result = await readContinuationRun(world as never, "run", new AbortController().signal);
  expect(result.input).toEqual([{ chatId: "chat" }]);
  expect(world.runs.get).toHaveBeenCalledExactlyOnceWith("run", { resolveData: "all" });
});
it.each([
  new Uint8Array(16_777_217),
  new TextEncoder().encode("encrno-key"),
  new TextEncoder().encode("devlinvalid"),
])("sanitizes oversized, undecryptable and malformed input", async data => {
  const world = fixture(data);
  await expect(
    readContinuationRun(world as never, "run", new AbortController().signal),
  ).rejects.toMatchObject({ code: "stream_continuation_evidence_unavailable" });
  expect(world.runs.get).toHaveBeenCalledTimes(1);
});
it("bounds a stuck read without retrying", async () => {
  const world = fixture();
  world.runs.get.mockImplementation(() => new Promise(() => {}));
  const controller = new AbortController();
  const result = readContinuationRun(world as never, "run", controller.signal);
  controller.abort();
  await expect(result).rejects.toMatchObject({ code: "stream_continuation_evidence_unavailable" });
  expect(world.runs.get.mock.calls.length).toBeLessThanOrEqual(1);
});
it("sanitizes backend exceptions without exposing input or credentials", async () => {
  const world = fixture();
  world.runs.get.mockRejectedValue(new Error("private-token"));
  const response = await gateStoredContinuation(new Request("https://test"), scope, "admitted");
  expect(response?.status).toBe(503);
  expect(await response?.json()).toEqual({
    status: "error",
    error: "stream_continuation_evidence_unavailable",
    admission: "admitted",
    runId: "run",
  });
});
it("requires capability for marked runs and does not reclassify from a header", async () => {
  fixture();
  expect(
    (await gateStoredContinuation(new Request("https://test"), scope, "existing"))?.status,
  ).toBe(409);
  expect(
    await gateStoredContinuation(
      new Request("https://test", {
        headers: { "X-Recoup-Stream-Continuation": "canonical-base-v1" },
      }),
      scope,
      "existing",
    ),
  ).toBeNull();
  fixture([{ ...input[0], streamProtocol: undefined }]);
  expect(
    (
      await gateStoredContinuation(
        new Request("https://test", {
          headers: { "X-Recoup-Stream-Continuation": "canonical-base-v1" },
        }),
        scope,
        "existing",
      )
    )?.status,
  ).toBe(503);
  fixture([{ ...input[0], streamProtocol: "unmarked-v1" }]);
  expect(await gateStoredContinuation(new Request("https://test"), scope, "existing")).toBeNull();
});
