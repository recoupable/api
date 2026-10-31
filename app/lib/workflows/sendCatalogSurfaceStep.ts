import type { UIMessage, UIMessageChunk } from "ai";
import type { prepareCatalogSurface } from "@/lib/intelligent-ui/prepareCatalogSurface";

/** One complete v1 snapshot; stream rejection/cancellation stops delivery, never a partial patch. */
export async function sendCatalogSurfaceStep(
  writable: WritableStream<UIMessageChunk>,
  assistantMessageId: string,
  prepared: Awaited<ReturnType<typeof prepareCatalogSurface>>,
  presentation: "snapshot" | "text" = "snapshot",
): Promise<UIMessage> {
  "use step";
  const { surface } = prepared;
  const writer = writable.getWriter();
  try {
    if (presentation === "text") {
      await writer.write({ type: "text-start", id: surface.id });
      await writer.write({ type: "text-delta", id: surface.id, delta: surface.fallbackText });
      await writer.write({ type: "text-end", id: surface.id });
    } else {
      await writer.write({ type: "data-intelligent-ui-snapshot", id: surface.id, data: surface });
    }
  } finally {
    writer.releaseLock();
  }
  return {
    id: assistantMessageId,
    role: "assistant",
    parts:
      presentation === "text"
        ? [{ type: "text", text: surface.fallbackText }]
        : [{ type: "data-intelligent-ui-snapshot", id: surface.id, data: surface }],
  };
}
