import { prepareCatalogSurface } from "@/lib/intelligent-ui/prepareCatalogSurface";
import {
  catalogSurfaceRequestSchema,
  type CatalogSurfaceRequest,
} from "@/lib/intelligent-ui/catalogSurfaceRequest";

/** Journal one authorized saved read; the server owns its UTC window and bounded first page. */
export async function prepareCatalogSurfaceStep(input: {
  accountId: string;
  context: CatalogSurfaceRequest;
  assistantMessageId: string;
}) {
  "use step";
  if (process.env.NODE_ENV !== "development")
    throw new Error("Catalog surfaces are development-only");
  const context = catalogSurfaceRequestSchema.parse(input.context);
  if (context.workspace.kind === "account" && context.workspace.id !== input.accountId)
    throw new Error("Catalog not found");
  const today = Date.parse(new Date().toISOString().slice(0, 10));
  const since = new Date(today - 28 * 86400000).toISOString().slice(0, 10);
  return prepareCatalogSurface({
    accountId: input.accountId,
    workspaceId: context.workspace.id,
    assistantMessageId: input.assistantMessageId,
    query: { catalog_id: context.subject.id, since, days: 28, page: 1, limit: 25 },
  });
}
