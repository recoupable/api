import { join } from "node:path";
import { nodeSkillFiles } from "@modelcontextprotocol/server/ext/skills/node";

export const recoupSkillFiles = nodeSkillFiles(join(process.cwd(), ".mcp-skills/generated"));
