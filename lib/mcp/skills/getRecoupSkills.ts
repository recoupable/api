import { join } from "node:path";
import { SkillsExtension, type SkillCatalog } from "@modelcontextprotocol/server/ext/skills";
import { nodeSkillFiles } from "@modelcontextprotocol/server/ext/skills/node";

const files = nodeSkillFiles(join(process.cwd(), ".mcp-skills/generated"));
const catalogs = new Map<boolean, Promise<SkillCatalog>>();

/** Build the catalog from the immutable deployment bundle once per audience. */
export function getRecoupSkills(staff: boolean): Promise<SkillCatalog> {
  const cached = catalogs.get(staff);
  if (cached) return cached;

  const catalog = SkillsExtension.load(
    {
      read: path => files.read(path),
      list: async path => {
        const children = await files.list(path);
        return staff || path
          ? children
          : children.filter(child => !child.name.startsWith("recoup-internal-"));
      },
    },
    { strict: true, limits: { files: 1024 }, pageSize: 25 },
  ).catch((error: unknown) => {
    catalogs.delete(staff);
    throw error;
  });
  catalogs.set(staff, catalog);
  return catalog;
}
