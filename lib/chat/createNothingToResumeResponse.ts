import { createUIMessageStreamResponse, type UIMessageChunk } from "ai";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * The answer to "resume this chat" when there is no turn in flight.
 *
 * This used to be a bare `204`, which does not terminate the client's resume
 * loop. `WorkflowChatTransport` exits `while (!gotFinish)` only when it reads a
 * chunk of type `finish`; its other exit is `if (!res.ok || !res.body)`, and a
 * 204 fails both tests — it is in the 2xx range so `ok` is true, and a
 * cross-origin 204 reaches the browser as a non-null empty `ReadableStream`.
 * So the loop parsed an empty stream, never finished, and re-requested
 * immediately, forever: ~3 requests a second per open tab, measured at 37 in
 * 15s on a healthy chat and 3,375 on one tab (recoupable/app#2052).
 *
 * Upstream open-agents does not hit this because its chat UI and this route are
 * same-origin, so its 204 arrives body-null and its client-side guard fires.
 * Ours are split across `app.` and `api.`, so the fix belongs here: say
 * "finished" in the protocol the client already understands, rather than
 * relying on it to infer termination from a status code.
 *
 * @returns A 200 UI-message stream carrying one terminal `finish` chunk.
 */
export function createNothingToResumeResponse(): Response {
  const stream = new ReadableStream<UIMessageChunk>({
    start(controller) {
      controller.enqueue({ type: "finish" });
      controller.close();
    },
  });

  return createUIMessageStreamResponse({ stream, headers: getCorsHeaders() });
}
