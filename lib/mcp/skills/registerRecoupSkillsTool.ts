import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { McpAuthInfo } from "../verifyApiKey";
import { getRecoupSkills } from "./getRecoupSkills";
import { readRecoupSkillFile } from "./readRecoupSkillFile";
import { resolveRecoupSkillsAudience } from "./resolveRecoupSkillsAudience";
import { recoupSkillsToolSchema } from "./recoupSkillsToolSchema";

const pageSize = 25;
const unavailable: CallToolResult = {
  isError: true,
  content: [{ type: "text", text: "This Recoup skill or file is unavailable." }],
};

/** Make the signed-in catalog available in clients that discover connector tools. */
export function registerRecoupSkillsTool(server: McpServer) {
  server.registerTool(
    "recoup_skills",
    {
      title: "Recoup Skills",
      description:
        "Find and load Recoup workflows available to the connected account. Search by topic or list the catalog, then pass a matching skill name to load its instructions before running the workflow. Use file to load a supporting file referenced by those instructions.",
      inputSchema: recoupSkillsToolSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async ({ query, offset = 0, skill, file = "SKILL.md" }, extra): Promise<CallToolResult> => {
      const authInfo = extra.authInfo as McpAuthInfo | undefined;
      const audience = await resolveRecoupSkillsAudience(authInfo).catch((error: unknown) => {
        if (
          error instanceof Error &&
          /^Tool rate limit reached; retry in \d+ seconds$/.test(error.message)
        )
          throw error;
        return undefined;
      });
      if (!audience) return unavailable;
      const catalog = await getRecoupSkills(audience);
      if (!skill) {
        const terms = query?.toLowerCase().split(/\s+/).filter(Boolean) ?? [];
        const matches = catalog.entries
          .map(({ frontmatter: { name, description } }) => ({ name, description }))
          .filter(({ name, description }) =>
            terms.every(term => `${name} ${description}`.toLowerCase().includes(term)),
          );
        const next = offset + pageSize;
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                skills: matches.slice(offset, next),
                ...(next < matches.length ? { nextOffset: next } : {}),
              }),
            },
          ],
        };
      }

      const entry = catalog.entries.find(entry => entry.frontmatter.name === skill);
      if (!entry || entry.resources === "dynamic") return unavailable;
      const resource = entry.resources.find(
        ({ uri }) => decodeURIComponent(new URL(uri).pathname.slice(1)) === file,
      );
      if (!resource) return unavailable;

      const { uri } = resource;
      const bytes = await readRecoupSkillFile(uri);
      try {
        if (!bytes.includes(0)) {
          const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
          return { content: [{ type: "text", text }] };
        }
      } catch {
        // Return non-text files as an embedded resource.
      }
      return {
        content: [
          { type: "resource", resource: { uri, blob: Buffer.from(bytes).toString("base64") } },
        ],
      };
    },
  );
}
