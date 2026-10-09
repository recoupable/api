import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { evidenceAttachmentOperationSchemas } from "@/lib/context/evidenceAttachmentSchemas";
import { contextToolOperations } from "@/lib/mcp/oauth/contextToolOperations";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { handleContextToolOperation } from "./handleContextToolOperation";

/** Object schemas make unpaid evidence operations discoverable to standard MCP clients. */
export function registerContextEvidenceTools(server: McpServer) {
  for (const operation of evidenceAttachmentOperationSchemas) {
    const action = operation.shape.action.value;
    const metadata = contextToolOperations[action];
    const inputSchema = (operation as z.ZodObject).omit({ action: true });
    server.registerTool(
      metadata.name,
      {
        description: metadata.description,
        inputSchema,
        annotations: {
          readOnlyHint: metadata.readOnly,
          destructiveHint: false,
          openWorldHint: false,
        },
      },
      async (raw, extra) => {
        try {
          const args = inputSchema.parse(raw);
          return await handleContextToolOperation({ ...args, action }, extra);
        } catch {
          return {
            ...getToolResultError("Invalid evidence arguments. Check the tool schema."),
            isError: true,
          };
        }
      },
    );
  }
}
