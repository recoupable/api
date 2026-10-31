import { z } from "zod";
import type { ChatMessageTrailingBoundary } from "./ChatMessageTrailingBoundary";

const boundarySchema = z.object({
  fromTimestamp: z.iso.datetime({ offset: true }),
  fromMessageId: z.string().uuid(),
});

/** Validate and quote an inclusive tuple boundary without losing timestamp precision. */
export function buildChatMessageTrailingDeleteFilter(
  boundary: ChatMessageTrailingBoundary,
): string {
  const { fromTimestamp, fromMessageId } = boundarySchema.parse(boundary);
  return `created_at.gt."${fromTimestamp}",and(created_at.eq."${fromTimestamp}",id.gte.${fromMessageId})`;
}
