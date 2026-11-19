import { FatalError } from "workflow";
import { hasRetainedFieldContent } from "@/lib/sessions/chats/retained-field/hasRetainedFieldContent";

/** Deny the entire invocation, never prune messages and orphan tool-call/result pairs. */
export function assertNoRetainedFieldModelInput(input: unknown): void {
  if (hasRetainedFieldContent(input)) {
    // Static redacted failure. No positive authority, retries or cached-ready admission.
    throw new FatalError("Retained-field model input unavailable");
  }
}
