import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { evidenceAttachmentOperationSchemas } from "@/lib/context/evidenceAttachmentSchemas";
import { contextToolOperations } from "@/lib/mcp/oauth/contextToolOperations";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { handleContextToolOperation } from "./handleContextToolOperation";

/** Object schemas make unpaid evidence operations discoverable to standard MCP clients. */
export function registerContextEvidenceTools(server: McpServer) {
  const prepare = (operation: (typeof evidenceAttachmentOperationSchemas)[number]) => {
    const action = operation.shape.action.value;
    const metadata = contextToolOperations[action];
    const inputSchema = (operation as z.ZodObject).omit({ action: true });
    const config = {
      description: metadata.description,
      inputSchema,
      annotations: {
        readOnlyHint: metadata.readOnly,
        destructiveHint: false,
        openWorldHint: false,
      },
    };
    const handler = async (
      raw: unknown,
      extra: Parameters<typeof handleContextToolOperation>[1],
    ) => {
      try {
        const args = inputSchema.parse(raw);
        return await handleContextToolOperation({ ...args, action }, extra);
      } catch {
        return {
          ...getToolResultError("Invalid evidence arguments. Check the tool schema."),
          isError: true,
        };
      }
    };
    return { config, handler };
  };
  const attach = prepare(evidenceAttachmentOperationSchemas[0]);
  const read = prepare(evidenceAttachmentOperationSchemas[1]);
  const list = prepare(evidenceAttachmentOperationSchemas[2]);
  server.registerTool("attach_music_evidence", attach.config, attach.handler);
  server.registerTool("read_music_evidence_attachment", read.config, read.handler);
  server.registerTool("list_music_evidence_attachments", list.config, list.handler);
}
