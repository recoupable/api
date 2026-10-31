import { z } from "zod";
import { contextOperationSchema } from "@/lib/context/processContextOperation";
import {
  evidenceAttachmentReceiptSchema,
  evidenceAttachmentListSchema,
} from "@/lib/context/evidenceAttachmentSchemas";
import { contextToolOperations } from "@/lib/mcp/oauth/contextToolOperations";
import {
  contextResponseSchemas,
  contextResponseReferences,
  contextResponseStatusCodes,
} from "@/lib/context/contracts/contextOperationResponseCatalog";

/** Export source contracts without presenting standard-only tools as delegated capabilities. */
export function buildContextOperationCatalog() {
  const undocumentedActions: string[] = [];
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
    responseSchemas: Object.fromEntries(
      Object.entries(contextResponseSchemas).map(([name, schema]) => [name, jsonSchema(schema)]),
    ),
    responseReferences: contextResponseReferences,
    responseStatusCodes: contextResponseStatusCodes,
    evidenceSchemas: {
      receipt: jsonSchema(evidenceAttachmentReceiptSchema),
      page: jsonSchema(evidenceAttachmentListSchema),
    },
  };
}
