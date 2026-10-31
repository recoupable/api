import { NextResponse } from "next/server";
import { z } from "zod";
import { paginationQuerySchema } from "@/lib/zod/paginationQuerySchema";
import { validationErrorResponse } from "@/lib/zod/validationErrorResponse";

const schema = paginationQuerySchema({ defaultLimit: 10, maxLimit: 100 })
  .extend({
    artist_account_id: z.string().uuid(),
    post_id: z.string().uuid().optional(),
  })
  .strict()
  .refine(value => (value.page - 1) * value.limit + value.limit <= 2147483647, {
    message: "Requested page exceeds the supported range",
    path: ["page"],
  });

export type GetCommentsQuery = z.infer<typeof schema>;

/** Parse the documented stored-post UUID and bounded page window. */
export function validateGetCommentsQuery(params: URLSearchParams): GetCommentsQuery | NextResponse {
  for (const key of params.keys()) {
    if (params.getAll(key).length > 1) {
      return validationErrorResponse("Query parameters must not be repeated", [key]);
    }
  }
  const result = schema.safeParse(Object.fromEntries(params));
  if (!result.success) {
    const issue = result.error.issues[0];
    return validationErrorResponse(issue.message, issue.path);
  }
  return result.data;
}
