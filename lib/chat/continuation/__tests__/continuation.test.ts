import { describe, it, expect } from "vitest";
import { buildContinuationMarker } from "../buildContinuationMarker";
import { selectStreamProtocol } from "../selectStreamProtocol";
import { assertMarkerFreeHistory } from "../assertMarkerFreeHistory";
import { validateContinuationRun } from "../validateContinuationRun";
const base = {
  id: "a",
  role: "assistant" as const,
  parts: [{ type: "text" as const, text: "prior", state: "done" as const }],
};
const scope = { runId: "run", accountId: "account", chatId: "chat", sessionId: "session" };
const record = () => ({
  runId: "run",
  workflowName: "workflow//./app/lib/workflows/runAgentWorkflow.ts//runAgentWorkflow",
  input: [
    {
      ...scope,
      runId: undefined,
      messages: [],
      modelId: "model",
      agentContext: {},
      streamProtocol: "canonical-base-v1",
    },
  ],
});
describe("canonical continuation contract", () => {
  it("requires exact capability for assistant reuse; fresh stays explicitly unmarked", () => {
    for (const capability of [null, "unknown", "canonical-base-v1, canonical-base-v1"])
      expect(() => selectStreamProtocol([base], false, capability)).toThrow(
        "stream_continuation_upgrade_required",
      );
    expect(selectStreamProtocol([base], false, "canonical-base-v1")).toBe("canonical-base-v1");
    expect(selectStreamProtocol([], false, null)).toBe("unmarked-v1");
    expect(selectStreamProtocol([base], true, null)).toBe("unmarked-v1");
  });
  it("builds an immutable exact canonical base without native substitutions", async () => {
    const marker = await buildContinuationMarker(base, "a");
    expect(marker).toEqual({ version: 1, mode: "continuation", base });
    expect(marker.base).not.toBe(base);
  });
  it.each([
    { ...base, id: "other" },
    { ...base, role: "user" },
    { ...base, extra: true },
    { ...base, parts: [{ type: "custom", kind: "x" }] },
    { ...base, parts: [{ type: "text", text: 1 }] },
    { ...base, metadata: { recoupStream: {} } },
    { ...base, parts: Array.from({ length: 2049 }, () => ({ type: "text", text: "x" })) },
    { ...base, parts: [{ type: "text", text: "x".repeat(1_048_576) }] },
    { ...base, metadata: { bad: NaN } },
  ])("rejects malformed, native, nested or oversized bases", async value => {
    await expect(buildContinuationMarker(value, "a")).rejects.toThrow();
  });
  it("rejects reserved control metadata at history ingress", () => {
    expect(() =>
      assertMarkerFreeHistory([{ ...base, metadata: { nested: { recoupStream: {} } } }]),
    ).toThrow();
    expect(() => assertMarkerFreeHistory([base])).not.toThrow();
  });
  it("validates stored requirement and exact scope, not a caller claim", () => {
    const run = record();
    delete run.input[0].runId;
    expect(validateContinuationRun(run, scope, "canonical-base-v1")).toBe("canonical-base-v1");
    expect(() => validateContinuationRun(run, scope, null)).toThrow(
      "stream_continuation_upgrade_required",
    );
    for (const field of ["accountId", "chatId", "sessionId"] as const) {
      const bad = structuredClone(run);
      bad.input[0][field] = "other";
      expect(() => validateContinuationRun(bad, scope, "canonical-base-v1")).toThrow();
    }
    for (const field of ["runId", "workflowName"] as const) {
      const bad = { ...run, [field]: "other" };
      expect(() => validateContinuationRun(bad, scope, "canonical-base-v1")).toThrow();
    }
    for (const protocol of [undefined, null, "unknown"]) {
      expect(() =>
        validateContinuationRun(
          { ...run, input: [{ ...run.input[0], streamProtocol: protocol }] },
          scope,
          "canonical-base-v1",
        ),
      ).toThrow();
    }
    expect(() =>
      validateContinuationRun({ ...run, expiredAt: new Date() }, scope, "canonical-base-v1"),
    ).toThrow();
  });
});
it("rejects deep/value-heavy, accessor and non-JSON markers without invoking accessors", async () => {
  let deep: unknown = null;
  for (let i = 0; i < 35; i++) deep = { deep };
  await expect(buildContinuationMarker({ ...base, metadata: deep }, "a")).rejects.toThrow();
  await expect(
    buildContinuationMarker({ ...base, metadata: Array(50_001).fill(0) }, "a"),
  ).rejects.toThrow();
  const metadata = Object.defineProperty({}, "private", {
    get() {
      throw new Error("getter invoked");
    },
    enumerable: true,
  });
  await expect(buildContinuationMarker({ ...base, metadata }, "a")).rejects.toThrow(
    "stream_continuation_invalid",
  );
  await expect(buildContinuationMarker({ ...base, metadata: new Date() }, "a")).rejects.toThrow();
});
it("preserves originals nested inside canonical observation data", async () => {
  const canonical = {
    ...base,
    parts: [
      {
        type: "data-recoup-sdk-observation",
        id: "observation",
        data: { original: { type: "custom", kind: "provider-part", data: { text: "retained" } } },
      },
      ...base.parts,
    ],
  };
  expect((await buildContinuationMarker(canonical, "a")).base).toEqual(canonical);
});
it("retains opaque reserved-name keys inside provider originals and tool output", async () => {
  const opaque = { recoupStream: { ordinary: "opaque value" } };
  const canonical = {
    ...base,
    parts: [
      {
        type: "data-recoup-sdk-observation",
        id: "observation",
        data: {
          original: {
            type: "custom",
            kind: "provider-content",
            providerMetadata: { provider: opaque },
          },
        },
      },
      {
        type: "tool-example",
        toolCallId: "tool",
        state: "output-available",
        input: {},
        output: opaque,
      },
    ],
  };
  expect(() => assertMarkerFreeHistory([canonical])).not.toThrow();
  expect((await buildContinuationMarker(canonical, "a")).base).toEqual(canonical);
});
it("parses only the actual fenced tuple and binds its authority", () => {
  const accountId = "11111111-1111-4111-8111-111111111111";
  const run = record();
  delete run.input[0].runId;
  const invocation = {
    kind: "internal-fenced/v1",
    input: { ...run.input[0], accountId },
    fence: {
      authority: {
        chatId: "chat",
        effectiveAccount: accountId,
        epoch: 1,
        owner: "22222222-2222-4222-8222-222222222222",
      },
      attemptId: "33333333-3333-4333-8333-333333333333",
      turn: { kind: "same-turn-resume", assistantId: "a" },
    },
  };
  expect(
    validateContinuationRun(
      { ...run, input: [invocation] },
      { ...scope, accountId },
      "canonical-base-v1",
    ),
  ).toBe("canonical-base-v1");
  expect(() =>
    validateContinuationRun(
      { ...run, input: { arbitrary: [invocation] } },
      { ...scope, accountId },
      "canonical-base-v1",
    ),
  ).toThrow();
  invocation.fence.authority.chatId = "other";
  expect(() =>
    validateContinuationRun(
      { ...run, input: [invocation] },
      { ...scope, accountId },
      "canonical-base-v1",
    ),
  ).toThrow();
});
