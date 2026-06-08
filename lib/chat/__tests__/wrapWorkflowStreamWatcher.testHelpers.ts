import { vi } from "vitest";
import type { UIMessageChunk } from "ai";
import { getRun } from "workflow/api";

export const RUN_ID = "wrun_test_abc";

export function mockRun(opts: { status: () => string; cancel?: () => Promise<void> }) {
  const cancel = opts.cancel ?? vi.fn(() => Promise.resolve());
  vi.mocked(getRun).mockReturnValue({
    get status() {
      return Promise.resolve(opts.status());
    },
    cancel,
  } as never);
  return { cancel };
}

export async function collect(stream: ReadableStream<UIMessageChunk>): Promise<UIMessageChunk[]> {
  const reader = stream.getReader();
  const out: UIMessageChunk[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) return out;
    out.push(value);
  }
}

export function chunkSource(chunks: UIMessageChunk[]): ReadableStream<UIMessageChunk> {
  return new ReadableStream<UIMessageChunk>({
    start(controller) {
      for (const c of chunks) controller.enqueue(c);
      controller.close();
    },
  });
}
