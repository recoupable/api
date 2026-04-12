import { createElevenLabsProxyHandler } from "./handleElevenLabsProxy";
import { validateComposeDetailedBody } from "./validateComposeDetailedBody";

/**
 * Handler for POST /api/music/compose/detailed.
 * Generates a song with metadata and optional word timestamps.
 * Proxies the multipart/mixed response from ElevenLabs directly.
 */
export const composeDetailedHandler = createElevenLabsProxyHandler({
  path: "/v1/music/detailed",
  validate: validateComposeDetailedBody,
  defaultContentType: "multipart/mixed",
  errorContext: "Music generation",
});
