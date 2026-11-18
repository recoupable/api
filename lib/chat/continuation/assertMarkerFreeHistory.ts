import { encodeBoundedContinuationValue } from "./encodeBoundedContinuationValue";
import { ContinuationError } from "./ContinuationError";
/** Controls in message metadata are reserved; opaque part/provider/tool payload keys are data. */
export function assertMarkerFreeHistory(messages: unknown) {
  encodeBoundedContinuationValue(messages, {
    maxBytes: 16_777_216,
    maxDepth: 64,
    maxValues: 250_000,
    omitUndefined: true,
  });
  if (!Array.isArray(messages)) throw new ContinuationError("stream_continuation_invalid");
  for (const message of messages) {
    if (!message || typeof message !== "object")
      throw new ContinuationError("stream_continuation_invalid");
    if (Object.hasOwn(message, "recoupStream"))
      throw new ContinuationError("stream_continuation_invalid");
    for (const field of ["metadata", "messageMetadata"]) {
      if (message[field] !== undefined)
        encodeBoundedContinuationValue(message[field], {
          rejectMarker: true,
          maxBytes: 16_777_216,
          maxDepth: 64,
          maxValues: 250_000,
          omitUndefined: true,
        });
    }
  }
}
