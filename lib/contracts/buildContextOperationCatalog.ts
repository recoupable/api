import { z } from "zod";
import { contextOperationSchema } from "@/lib/context/processContextOperation";
import {
  evidenceAttachmentReceiptSchema,
  evidenceAttachmentListSchema,
} from "@/lib/context/evidenceAttachmentSchemas";
import { contextToolOperations } from "@/lib/mcp/oauth/contextToolOperations";

/** Export source contracts without presenting standard-only tools as delegated capabilities. */
export function buildContextOperationCatalog() {
  const undocumentedActions = ["plan_catalog_members"];
  const jsonSchema = (schema: z.ZodType) => {
    const { $schema: _dialect, ...result } = z.toJSONSchema(schema, { io: "input" });
    return result;
  };
  const operations = Object.entries(contextToolOperations).filter(
    ([action]) => !undocumentedActions.includes(action),
  );
  const names = (delegated: boolean) =>
    Object.fromEntries(
      operations
        .filter(([, item]) => {
          const allowed = !("delegated" in item && item.delegated === false);
          return allowed === delegated;
        })
        .map(([action, { name, readOnly }]) => [action, { name, readOnly }]),
    );
  return {
    undocumentedActions,
    requestSchemas: contextOperationSchema.options
      .filter(schema => !undocumentedActions.includes(schema.shape.action.value))
      .map(jsonSchema),
    mcpOperations: names(true),
    standardMcpOperations: names(false),
    evidenceSchemas: {
      receipt: jsonSchema(evidenceAttachmentReceiptSchema),
      page: jsonSchema(evidenceAttachmentListSchema),
    },
  };
}
