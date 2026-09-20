import { runStoredContextRequest } from "@/lib/context/runStoredContextRequest";
/** Database claim fences duplicate deliveries; free metadata requests may retry. */
export async function runContextStep(actor: string, owner: string, requestId: string) {
  "use step";
  return runStoredContextRequest(actor, owner, requestId);
}
