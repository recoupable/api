import { prepareCatalogSurface } from "@/lib/intelligent-ui/prepareCatalogSurface";
import { catalogSurfaceRequestSchema } from "@/lib/intelligent-ui/catalogSurfaceRequest";
import type { z } from "zod";

/** Journal the authorized explicit query separately from delivery; replay must not refetch. */
export async function prepareCatalogSurfaceStep(
  input: z.input<typeof catalogSurfaceRequestSchema> & {
    accountId: string;
    assistantMessageId: string;
  },
) {
  "use step";
  if (process.env.NODE_ENV !== "development")
    throw new Error("Catalog surfaces are development-only");
  const selection = catalogSurfaceRequestSchema.parse({
    workspaceId: input.workspaceId,
    query: input.query,
  });
  return prepareCatalogSurface({
    ...selection,
    accountId: input.accountId,
    assistantMessageId: input.assistantMessageId,
  });
}
