import { experienceContractSchema } from "./experienceContract";
/** Reject unsupported promises and incomplete test plans before production spending. */
export function validateExperienceContract(input: unknown) {
  const contract = experienceContractSchema.parse(input);
  for (const checkpoint of ["participate", "result", "delivery"]) {
    if (!contract.steps.some(step => step.checkpoint === checkpoint))
      throw new Error(`Missing fan journey checkpoint: ${checkpoint}`);
  }
  if (
    contract.steps.findIndex(s => s.checkpoint === "result") <=
      contract.steps.findIndex(s => s.checkpoint === "participate") ||
    contract.steps.findIndex(s => s.checkpoint === "delivery") <=
      contract.steps.findIndex(s => s.checkpoint === "result")
  )
    throw new Error("Fan journey must participate, reach a result, then deliver it");
  for (const [capability, action] of [
    ["image-download", "download"],
    ["file-share", "share"],
  ]) {
    if (
      contract.capabilities.includes(capability as "image-download" | "file-share") &&
      !contract.steps.some(s => s.action === action)
    )
      throw new Error(`Missing actual ${action} test`);
  }
  if (
    contract.capabilities.includes("file-share") &&
    !contract.capabilities.includes("image-download")
  )
    throw new Error("File sharing requires a tested download fallback");
  for (const step of contract.steps) {
    if (!["download", "share"].includes(step.action) && !step.expected.trim())
      throw new Error("Every interaction must verify a visible outcome");
  }
  return contract;
}
