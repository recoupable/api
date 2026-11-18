import { encodeBoundedContinuationValue } from "./encodeBoundedContinuationValue";
/** Reserved transport controls may never enter history, model input or persistence. */
export function assertMarkerFreeHistory(messages: unknown) {
  encodeBoundedContinuationValue(messages, {
    rejectMarker: true,
    maxBytes: 16_777_216,
    maxDepth: 64,
    maxValues: 250_000,
    omitUndefined: true,
  });
}
