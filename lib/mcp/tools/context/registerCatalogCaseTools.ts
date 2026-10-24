import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { catalogCaseOperationSchemas } from "@/lib/context/catalogCaseOperationSchemas";
import { catalogCaseToolOperations } from "@/lib/mcp/oauth/catalogCaseToolOperations";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { handleContextToolOperation } from "./handleContextToolOperation";

/** Object inputs expose catalog artifact operations to standalone standard MCP clients. */
export function registerCatalogCaseTools(server: McpServer) {
  const prepare = (operation: (typeof catalogCaseOperationSchemas)[number]) => {
    const { action: actionSchema, ...shape } = operation.shape;
    const action = actionSchema.value;
    const metadata = catalogCaseToolOperations[action];
    const inputSchema = z.strictObject(shape);
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
        // Shared processor rechecks refinements after binding the server-owned action.
        return await handleContextToolOperation({ ...inputSchema.parse(raw), action }, extra);
      } catch {
        return {
          ...getToolResultError("Invalid catalog case arguments. Check the tool schema."),
          isError: true,
        };
      }
    };
    return { config, handler };
  };
  const save = prepare(catalogCaseOperationSchemas[0]);
  const read = prepare(catalogCaseOperationSchemas[1]);
  const list = prepare(catalogCaseOperationSchemas[2]);
  server.registerTool("save_catalog_case", save.config, save.handler);
  server.registerTool("read_catalog_case", read.config, read.handler);
  server.registerTool("list_catalog_cases", list.config, list.handler);
}
