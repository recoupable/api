import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { errorResponse } from "@/lib/networking/errorResponse";

export const createSnapshotBodySchema = z
  .object({
    catalog_id: z.uuid("catalog_id must be a valid UUID").optional(),
    album_ids: z.array(z.string()).min(1).optional(),
    isrcs: z.array(z.string()).min(1).optional(),
    platforms: z.array(z.enum(["spotify"])).default(["spotify"]),
    schedule: z.enum(["once", "monthly"]).default("once"),
  })
  .refine(body => [body.catalog_id, body.album_ids, body.isrcs].filter(Boolean).length === 1, {
    message: "Provide exactly one of catalog_id, album_ids, isrcs",
  });

export type CreateSnapshotBody = z.infer<typeof createSnapshotBodySchema>;

export type ValidatedCreateSnapshotRequest = {
  accountId: string;
  body: CreateSnapshotBody;
};

/**
 * Validates `POST /api/research/snapshots` — auth + body (exactly one of
 * `catalog_id` / `album_ids` / `isrcs`; `platforms` currently `spotify` only;
 * `schedule` once | monthly).
 *
 * @param request - The incoming HTTP request.
 */
export async function validateCreateSnapshotRequest(
  request: NextRequest,
): Promise<NextResponse | ValidatedCreateSnapshotRequest> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const raw = await request.json().catch(() => null);
  const result = createSnapshotBodySchema.safeParse(raw);
  if (!result.success) {
    return errorResponse(result.error.issues[0].message, 400);
  }

  return { accountId: authResult.accountId, body: result.data };
}
