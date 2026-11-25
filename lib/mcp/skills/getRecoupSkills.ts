import { SkillsExtension, type SkillCatalog } from "@modelcontextprotocol/server/ext/skills";
import { isStaffSkill } from "./isStaffSkill.mjs";
import { recoupSkillFiles } from "./recoupSkillFiles";

type Audience = "public" | "staff" | "all";

const catalogs = new Map<Audience, Promise<SkillCatalog>>();

/** Build the catalog from the immutable deployment bundle once per audience. */
export function getRecoupSkills(audience: Audience): Promise<SkillCatalog> {
  const cached = catalogs.get(audience);
  if (cached) return cached;

  const catalog = SkillsExtension.load(
    {
      read: path => recoupSkillFiles.read(path),
      list: async path => {
        const children = await recoupSkillFiles.list(path);
        return path || audience === "all"
          ? children
          : children.filter(child => isStaffSkill(child.name) === (audience === "staff"));
      },
    },
    { strict: true, limits: { files: 1024 }, pageSize: 100 },
  ).catch((error: unknown) => {
    catalogs.delete(audience);
    throw error;
  });
  catalogs.set(audience, catalog);
  return catalog;
}
