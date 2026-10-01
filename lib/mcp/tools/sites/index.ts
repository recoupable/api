import { registerUploadSiteAssetTool } from "./registerUploadSiteAssetTool";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { processSiteOperation } from "@/lib/sites/processSiteOperation";
import { siteOperationSchemas, type SiteOperation } from "@/lib/sites/siteOperationSchemas";
import { SiteError } from "@/lib/sites/SiteError";
import { ZodError } from "zod";
const operations: Record<SiteOperation, [string, string]> = {
  list: ["list_sites", "List Sites in your personal workspace or an organization you can access."],
  get: ["get_site", "Read a site's draft, published snapshot and revision before editing."],
  create: [
    "create_site",
    "Create a private site draft from a Spotify release URL and optional brief/assets. Then call propose_site_concepts and ask the customer to select a pitch. Does not publish.",
  ],
  concepts: [
    "propose_site_concepts",
    "Return short fan-motivation-first pitches or missing context. Show the pitches to the customer and wait for their selection before generate_site. Uses credits for context/pitching; does not build assets, code or overwrite the draft.",
  ],
  generate: [
    "generate_site",
    "Build a site from the saved release. Omit approvedConcept for automatic context collection and concept selection, or pass a customer-selected concept to preserve that choice. Requires latest revision. Returns a token to poll get_site_generation. Optional contextBriefId reuses saved evidence. Uses credits; does not publish.",
  ],
  generation: [
    "get_site_generation",
    "Poll the token returned by generate_site until completed or failed. Requires the same authenticated account and site id.",
  ],
  publish: [
    "publish_site",
    "Publish the saved draft to the public web. Only use when the account explicitly asks to publish. Requires latest revision.",
  ],
  delete: [
    "delete_site",
    "Permanently delete a site, its fan records and activity. Takes the public page offline. Only use after explicit customer authorization. Requires the latest revision; pass generationToken when available to cancel its active build.",
  ],
  unpublish: [
    "unpublish_site",
    "Remove a site's published snapshot from public access. Retains its draft. Requires latest revision.",
  ],
  signups: ["get_site_signups", "Read fan email signups for a site in an authorized workspace."],
};
/** Register thin MCP adapters over the same operations used by HTTP. */
export function registerAllSitesTools(server: McpServer) {
  registerUploadSiteAssetTool(server);
  for (const operation of Object.keys(operations) as SiteOperation[]) {
    const [name, description] = operations[operation];
    server.registerTool(
      name,
      {
        description,
        inputSchema: siteOperationSchemas[operation],
        annotations: {
          readOnlyHint: ["list", "get", "signups", "generation"].includes(operation),
          destructiveHint: ["publish", "unpublish", "delete"].includes(operation),
          openWorldHint: true,
        },
      },
      async (args, extra) => {
        const resolved = await resolveAccountId({
          authInfo: extra.authInfo as McpAuthInfo | undefined,
          accountIdOverride: undefined,
        });
        if (!resolved.accountId)
          return { ...getToolResultError("Authentication required"), isError: true };
        try {
          return getToolResultSuccess(
            await processSiteOperation(resolved.accountId, operation, args),
          );
        } catch (error) {
          return {
            ...getToolResultError(
              error instanceof SiteError
                ? error.message
                : error instanceof ZodError
                  ? "Invalid site input"
                  : "Could not finish the site operation",
            ),
            isError: true,
          };
        }
      },
    );
  }
}
