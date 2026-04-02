import { createElevenLabsProxyHandler } from "./handleElevenLabsProxy";
import { validateStreamBody } from "./validateStreamBody";

/**
 * Handler for POST /api/music/stream.
 * Generates a song and streams audio chunks directly to the client.
 * Does not buffer — pipes the upstream readable stream through.
 */
export const streamHandler = createElevenLabsProxyHandler({
  path: "/v1/music/stream",
  validate: validateStreamBody,
  defaultContentType: "audio/mpeg",
  errorContext: "Music streaming",
  extraHeaders: { "Transfer-Encoding": "chunked" },
});
