import { join } from "node:path";
import { SkillsExtension, type SkillCatalog } from "@modelcontextprotocol/server/ext/skills";
import { nodeSkillFiles } from "@modelcontextprotocol/server/ext/skills/node";
import { isStaffSkill } from "./isStaffSkill.mjs";

type Audience = "public" | "staff";

const files = nodeSkillFiles(join(process.cwd(), ".mcp-skills/generated"));
const catalogs = new Map<Audience, Promise<SkillCatalog>>();

/** Build the catalog from the immutable deployment bundle once per audience. */
export function getRecoupSkills(audience: Audience): Promise<SkillCatalog> {
  const cached = catalogs.get(audience);
  if (cached) return cached;

  const catalog = SkillsExtension.load(
    {
      read: path => files.read(path),
      list: async path => {
        const children = await files.list(path);
        return path
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
