import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ingestionOperationSchema } from "@/lib/ingestion/schemas";
import { handleIngestionToolOperation } from "./handleIngestionToolOperation";

/** Register private ingestion for standard authenticated connections. */
export function registerIngestionTool(server: McpServer) {
  if (process.env.INGESTION_ENABLED !== "true") return;
  server.registerTool(
    "ingestion",
    {
      description:
        "Create private data ingestion jobs from CSV, TSV, JSON/JSONL, XLSX or reviewed PDF text layouts; read job validation and bronze/silver/gold artifacts. Organization imports that reach ready status store their gold records in Recoup's existing database; optionally supply dataset_id to add a new immutable import to a dataset. Use datasets, imports and records to browse one organization and explicit import version. Supply explicit field mappings and controls. Held or rejected jobs have no publishable gold. Deliver only an explicitly approved exact gold_sha256 to an operator-configured destination_id. Never infer financial definitions or approve delivery from a filename. Private file bytes use base64; API sources use configured connector IDs. Large artifacts should be read through HTTP. This tool is unavailable for delegated OAuth.",
      inputSchema: ingestionOperationSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
    },
    handleIngestionToolOperation,
  );
}
