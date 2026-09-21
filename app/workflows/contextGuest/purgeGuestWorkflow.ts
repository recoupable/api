import { purgeGuestStep } from "./purgeGuestStep";
export async function purgeGuestWorkflow() {
  "use workflow";
  return purgeGuestStep();
}
