import { start } from "workflow/api";
import { guestContextWorkflow } from "@/app/workflows/contextGuest/guestContextWorkflow";
export async function dispatchGuestContext(id: string) {
  return start(guestContextWorkflow, [id]);
}
