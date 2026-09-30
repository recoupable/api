import { generateSite } from "../generateSite";
import { prepareBuildInput } from "./prepareBuildInput";
export async function buildExperience(...args: Parameters<typeof prepareBuildInput>) {
  const input = prepareBuildInput(...args);
  return generateSite(input.site, input.instruction, args[4]);
}
