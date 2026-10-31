import type { ChatFenceErrorKind } from "../classifyChatFenceError";
/** Safe error for required writes; workflow steps must terminalize or reconcile, never swallow it. */
export class FencedPersistenceError extends Error {
  readonly name = "FencedPersistenceError";
  constructor(
    readonly kind: ChatFenceErrorKind | "missing_message",
    readonly retrySameCommand = false,
  ) {
    super(`Required fenced persistence failed: ${kind}`);
  }
}
