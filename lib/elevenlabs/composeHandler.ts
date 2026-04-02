import { createElevenLabsProxyHandler } from "./handleElevenLabsProxy";
import { validateComposeBody } from "./validateComposeBody";

/**
 * Handler for POST /api/music/compose.
 * Generates a song from a text prompt or composition plan.
 * Returns binary audio with the song-id in response headers.
 */
export const composeHandler = createElevenLabsProxyHandler({
  path: "/v1/music",
  validate: validateComposeBody,
  defaultContentType: "audio/mpeg",
  errorContext: "Music generation",
});
