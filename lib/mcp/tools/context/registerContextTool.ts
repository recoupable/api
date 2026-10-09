import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { contextOperationSchema } from "@/lib/context/processContextOperation";
import { handleContextToolOperation } from "./handleContextToolOperation";
import { registerContextEvidenceTools } from "./registerContextEvidenceTools";
/** Same domain operations and ownership rules as POST /api/context. */
export function registerContextTool(server: McpServer) {
  server.registerTool(
    "context",
    {
      description:
        "Use attach_evidence with an exact retained source_version_id, an idempotency_key and typed existing targets (artist_id, professional_id, or request_id plus subject_id). This records relevance only, never confirms identity, rights or mandate. Use read_evidence_attachment for a receipt; list_evidence_attachments pages the exact source version using next_id as after_id while has_more is true, even for empty pages with withheld records. Current access is rechecked; sources are not recollected. Use list_release_cases and read_release_case to inspect saved release metadata without provider calls. review_release_case records metadata review only (reviewed or needs_changes), requires the exact current fingerprint and an idempotency key; it never approves rights or distribution. read_release_case_review retrieves an authorized historical receipt, withholding withdrawn evidence. Save reusable context from a Spotify track URL, read request progress, or compile a creative-direction/playlist-pitch evidence brief. For brief or save_brief, use request_id and optional additional_request_ids from the same workspace to combine saved song context without recollection. save_brief also requires idempotency_key and freezes the server-compiled output; use read_brief with brief_id for exact historical output. An unavailable snapshot withholds withdrawn evidence. Briefs include bounded text, per-request coverage and an input-version manifest. Inspect gaps; audio, lyrics, artwork analysis and research may be unavailable. Never treat partial context as full song understanding.",
      inputSchema: contextOperationSchema,
    },
    handleContextToolOperation,
  );
  registerContextEvidenceTools(server);
}
