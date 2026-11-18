import { expect, it } from "vitest";
import type { UIMessageChunk } from "ai";
import { collectCanonicalProjection } from "../collectCanonicalProjection";
async function* fresh(chunks: unknown[]) {
  for (const chunk of chunks) yield chunk as UIMessageChunk;
}
it("indexes mixed SDK parts and tool upserts against actual final SDK assembly", async () => {
  const chunks = [
    { type: "start-step" },
    { type: "text-start", id: "text" },
    { type: "text-delta", id: "text", delta: "before" },
    { type: "text-end", id: "text" },
    { type: "reasoning-start", id: "r" },
    { type: "reasoning-end", id: "r" },
    { type: "source-url", sourceId: "s", url: "https://example.invalid" },
    { type: "tool-input-start", toolCallId: "t", toolName: "probe" },
    { type: "tool-input-available", toolCallId: "t", toolName: "probe", input: {} },
    { type: "tool-output-available", toolCallId: "t", output: { done: true } },
    { type: "tool-input-available", toolCallId: "d", toolName: "probe", dynamic: true, input: {} },
    { type: "tool-output-available", toolCallId: "d", dynamic: true, output: {} },
    { type: "data-unrelated", id: "data", data: 1 },
    { type: "data-unrelated", id: "data", data: 2 },
    { type: "custom", kind: "provider.content" },
    { type: "file", mediaType: "image/png", url: "data:image/png;base64,AA==" },
    { type: "reasoning-file", mediaType: "image/png", url: "data:image/png;base64,AA==" },
    { type: "finish-step" },
  ];
  const written: unknown[] = [];
  const result = await collectCanonicalProjection({
    stream: fresh(chunks),
    previous: { id: "a", role: "assistant", parts: [] },
    runId: "run",
    stepId: () => "step",
    onProjection() {},
    write: async chunk => {
      written.push(chunk);
    },
  });
  expect(result.generatedProjectionObservations.observations).toHaveLength(2);
  expect(result.message.parts.filter(part => part.type === "tool-probe")).toHaveLength(1);
  expect(result.message.parts.filter(part => part.type === "dynamic-tool")).toHaveLength(1);
  expect(result.message.parts.filter(part => part.type === "data-unrelated")).toHaveLength(1);
  expect(written.some(chunk => (chunk as { type: string }).type === "custom")).toBe(false);
});
it("rejects a provider-supplied reserved envelope instead of counting it as proof", async () => {
  await expect(
    collectCanonicalProjection({
      stream: fresh([{ type: "data-recoup-sdk-observation", id: "forged", data: {} }]),
      previous: { id: "a", role: "assistant", parts: [] },
      runId: "run",
      stepId: () => "step",
      onProjection() {},
      write: async () => {
        throw new Error("must not write");
      },
    }),
  ).rejects.toMatchObject({ code: "invalid_observation" });
});
