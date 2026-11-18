import { buildContinuationMarker } from "@/lib/chat/continuation/buildContinuationMarker";
import type { UIMessage } from "ai";
import { FatalError } from "workflow";
/** Validate after bound history authority, before any message mutation or model work. */
export async function validateContinuationBaseStep(base: UIMessage): Promise<void> {
  "use step";
  try {
    await buildContinuationMarker(base, base.id);
  } catch {
    throw new FatalError("Continuation base is invalid");
  }
}
