import { assertMarkerFreeHistory } from "./assertMarkerFreeHistory";
import { validateUIMessages, type UIMessage } from "ai";
import { z } from "zod";
import { encodeBoundedContinuationValue } from "./encodeBoundedContinuationValue";
import { ContinuationError } from "./ContinuationError";
const schema = z
  .object({
    id: z.string().min(1).max(256),
    role: z.literal("assistant"),
    parts: z.array(z.object({ type: z.string().min(1) }).passthrough()).max(2048),
    metadata: z.unknown().optional(),
  })
  .strict();
/** Canonical base only; validation never translates or removes observation payloads. */
export async function buildContinuationMarker(value: unknown, messageId: string) {
  assertMarkerFreeHistory([value]);
  const marker = { version: 1 as const, mode: "continuation" as const, base: value };
  // Bounds apply to the complete marker, including its wrapper.
  const json = encodeBoundedContinuationValue(marker);
  const base = schema.safeParse(value);
  if (
    !base.success ||
    base.data.id !== messageId ||
    base.data.parts.some(part =>
      ["custom", "reasoning-file", "tool-approval-request", "tool-approval-response"].includes(
        part.type,
      ),
    )
  )
    throw new ContinuationError("stream_continuation_invalid");
  try {
    await validateUIMessages({ messages: [value] });
  } catch {
    throw new ContinuationError("stream_continuation_invalid");
  }
  return JSON.parse(json) as { version: 1; mode: "continuation"; base: UIMessage };
}
