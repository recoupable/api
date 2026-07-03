import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

export const addOrgMemberBodySchema = z
  .object({
    organizationId: z
      .string({ message: "organizationId is required" })
      .uuid("organizationId must be a valid UUID"),
    accountId: z.string().uuid("accountId must be a valid UUID").optional(),
    email: z.string().email("email must be a valid email address").optional(),
  })
  .refine(data => (data.accountId ? !data.email : !!data.email), {
    message: "Provide exactly one of accountId or email",
  });

export type AddOrgMemberBody = z.infer<typeof addOrgMemberBodySchema>;

/**
 * Validates request body for POST /api/organizations/members.
 *
 * @param body - The request body
 * @returns A NextResponse with an error if validation fails, or the validated body if validation passes.
 */
export function validateAddOrgMemberBody(body: unknown): NextResponse | AddOrgMemberBody {
  const result = addOrgMemberBodySchema.safeParse(body);

  if (!result.success) {
    const firstError = result.error.issues[0];
    return NextResponse.json(
      {
        status: "error",
        message: firstError.message,
      },
      {
        status: 400,
        headers: getCorsHeaders(),
      },
    );
  }

  return result.data;
}
