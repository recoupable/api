import { expect, it, vi } from "vitest";
import { createProjectionEvidencePorts } from "../createProjectionEvidencePorts";
const signal = new AbortController().signal;
function fixture() {
  const world = {
    runs: {
      get: vi.fn(async () => ({
        runId: "run",
        input: new TextEncoder().encode('devl[[1],{"chatId":2},"chat"]'),
      })),
    },
    steps: {
      get: vi.fn(async () => ({ runId: "run", stepId: "step", output: { marker: "proof" } })),
    },
    getEncryptionKeyForRun: vi.fn(async () => undefined),
  };
  const body = new TextEncoder().encode('devl[{"type":1,"messageId":2},"start","assistant"]');
  const bytes = new Uint8Array(body.length + 4);
  new DataView(bytes.buffer).setUint32(0, body.length, false);
  bytes.set(body, 4);
  const streams = {
    listStreamsByRunId: vi.fn(async () => ["run_user"]),
    getStreamInfo: vi.fn(async () => ({ tailIndex: 0, done: true })),
    getStreamChunks: vi.fn(async () => ({
      data: [{ index: 0, data: bytes }],
      cursor: null,
      hasMore: false,
      done: true,
    })),
  };
  Object.assign(world, streams);
  return { world, streams, bytes, ports: createProjectionEvidencePorts({ world: world as never }) };
}

it("reads only the requested run and completed-resource bytes without a default World", async () => {
  const { ports, world } = fixture();
  expect(await ports.readRun("run", signal)).toMatchObject({ input: [{ chatId: "chat" }] });
  expect(world.runs.get).toHaveBeenCalledWith("run", { resolveData: "all" });
  expect(await ports.readStep("run", "step", signal)).toMatchObject({
    output: { marker: "proof" },
  });
});
it("does not fall back to encrypted bytes when the existing World key is unavailable", async () => {
  const { ports, world } = fixture();
  world.runs.get.mockResolvedValue({
    runId: "run",
    input: new TextEncoder().encode("encrnot-readable"),
  } as never);
  await expect(ports.readRun("run", signal)).rejects.toMatchObject({ code: "key_unavailable" });
});
it("distinguishes expired resolved input", async () => {
  const { ports, world } = fixture();
  world.runs.get.mockResolvedValue({
    runId: "run",
    input: new TextEncoder().encode('devl[[1],{"expiredAt":2},"2026-01-01"]'),
  } as never);
  await expect(ports.readRun("run", signal)).rejects.toMatchObject({ code: "evidence_expired" });
});
it("reads exact framed stored chunks without opening a live subscription", async () => {
  const { ports, streams } = fixture();
  expect(await ports.readCanonical("run", signal)).toEqual([
    { type: "start", messageId: "assistant" },
  ]);
  expect(streams.getStreamChunks).toHaveBeenCalledWith("run_user", "run", {
    limit: 100,
    cursor: undefined,
  });
});
it("rejects missing stored chunks instead of treating a truncated snapshot as confirmed", async () => {
  const { ports, streams } = fixture();
  streams.getStreamChunks.mockResolvedValue({ data: [], cursor: null, hasMore: false, done: true });
  await expect(ports.readCanonical("run", signal)).rejects.toMatchObject({ code: "proof_pending" });
});
it("rejects excessive tails before accumulating content", async () => {
  const { ports, streams } = fixture();
  streams.getStreamInfo.mockResolvedValue({ tailIndex: 10000, done: false });
  await expect(ports.readCanonical("run", signal)).rejects.toMatchObject({
    code: "evidence_limit",
  });
  expect(streams.getStreamChunks).not.toHaveBeenCalled();
});
it("rejects trailing partial frame bytes that the SDK decoder can ignore", async () => {
  const { ports, streams, bytes } = fixture();
  const malformed = new Uint8Array(bytes.length + 1);
  malformed.set(bytes);
  streams.getStreamChunks.mockResolvedValue({
    data: [{ index: 0, data: malformed }],
    cursor: null,
    hasMore: false,
    done: true,
  });
  await expect(ports.readCanonical("run", signal)).rejects.toMatchObject({
    code: "invalid_evidence",
  });
});
it("rejects missing or reordered absolute chunk indexes", async () => {
  const { ports, streams, bytes } = fixture();
  streams.getStreamChunks.mockResolvedValue({
    data: [{ index: 1, data: bytes }],
    cursor: null,
    hasMore: false,
    done: true,
  });
  await expect(ports.readCanonical("run", signal)).rejects.toMatchObject({
    code: "canonical_mismatch",
  });
});
