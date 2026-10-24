import { z } from "zod";

const chatStreamLifecycleQuerySchema = z.object({
  streamLifecycle: z.tuple([z.literal("explicit-stop-v1")]),
});

/** Invalid or ambiguous opt-ins deliberately retain legacy disconnect cancellation. */
export function validateChatStreamLifecycleQuery(request: Pick<Request, "url">): boolean {
  return chatStreamLifecycleQuerySchema.safeParse({
    streamLifecycle: new URL(request.url).searchParams.getAll("streamLifecycle"),
  }).success;
}
