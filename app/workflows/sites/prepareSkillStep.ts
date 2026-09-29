import { prepareSiteSkill } from "@/lib/sites/skills/prepareSiteSkill";
import { FatalError } from "workflow";
export async function prepareSkillStep(...args: Parameters<typeof prepareSiteSkill>) {
  "use step";
  try {
    return await prepareSiteSkill(...args);
  } catch {
    throw new FatalError("Site skill preparation failed; no automatic paid retry attempted.");
  }
}
