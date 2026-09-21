import { guestContextStep } from "./guestContextStep";
export async function guestContextWorkflow(id: string) {
  "use workflow";
  return guestContextStep(id);
}
