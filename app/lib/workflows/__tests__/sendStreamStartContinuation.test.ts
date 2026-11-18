import { expect, it } from "vitest";
import { sendStreamStart } from "../sendStreamStart";
import type { UIMessageChunk } from "ai";
function writer() {
  const chunks: UIMessageChunk[] = [];
  return {
    chunks,
    stream: new WritableStream<UIMessageChunk>({
      write(chunk) {
        chunks.push(chunk);
      },
    }),
  };
}
it("emits the exact marked canonical base, preserving observation payload/index", async () => {
  const base = {
    id: "assistant",
    role: "assistant" as const,
    parts: [
      { type: "text" as const, text: "prior", state: "done" as const },
      {
        type: "data-recoup-sdk-observation" as const,
        id: "observation",
        data: {
          original: { type: "custom", kind: "provider-extra", data: { text: "original" } },
          fallback: { partIndex: 2 },
        },
      },
      {
        type: "text" as const,
        text: "This view cannot display additional model content.",
        state: "done" as const,
      },
    ],
  };
  const { stream, chunks } = writer();
  await sendStreamStart(stream, "assistant", base);
  expect(chunks).toEqual([
    {
      type: "start",
      messageId: "assistant",
      messageMetadata: { recoupStream: { version: 1, mode: "continuation", base } },
    },
  ]);
  expect(base).not.toHaveProperty("metadata.recoupStream");
});
it("leaves fresh starts unmarked", async () => {
  const { stream, chunks } = writer();
  await sendStreamStart(stream, "fresh");
  expect(chunks).toEqual([{ type: "start", messageId: "fresh" }]);
});
it("rejects invalid base before writer acquisition or bytes", async () => {
  const { stream, chunks } = writer();
  await expect(
    sendStreamStart(stream, "assistant", { id: "other", role: "assistant", parts: [] }),
  ).rejects.toThrow();
  expect(chunks).toEqual([]);
  expect(stream.locked).toBe(false);
});
