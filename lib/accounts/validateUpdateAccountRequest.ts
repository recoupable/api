import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { z } from "zod";

const knowledgeSchema = z.object({
  name: z.string(),
  url: z.string().url("knowledges.url must be a valid URL"),
  type: z.string(),
});

export const updateAccountBodySchema = z
  .object({
    accountId: z.string().uuid("accountId must be a valid UUID").optional(),
    name: z.string().optional(),
    instruction: z.string().optional(),
    organization: z.string().optional(),
    image: z.string().url("image must be a valid URL").optional().or(z.literal("")),
    jobTitle: z.string().optional(),
    roleType: z.string().optional(),
    companyName: z.string().optional(),
    knowledges: z.array(knowledgeSchema).optional(),
  })
  .refine(
    data => {
      const { accountId: _, ...fields } = data;
      return Object.values(fields).some(v => v !== undefined);
    },
    { message: "At least one field to update must be provided" },
  );

export type ValidatedUpdateAccountRequest = Omit<
  z.infer<typeof updateAccountBodySchema>,
  "accountId"
> & {
  accountId: string;
};

/**
 * Validates PATCH /api/accounts including auth, account override access, and body schema.
 *
 * @param request
 */
export async function validateUpdateAccountRequest(
  request: NextRequest,
): Promise<NextResponse | ValidatedUpdateAccountRequest> {
  const body = await safeParseJson(request);
  const result = updateAccountBodySchema.safeParse(body);

  if (!result.success) {
    const firstError = result.error.issues[0];
    return NextResponse.json(
      {
        status: "error",
        missing_fields: firstError.path,
        error: firstError.message,
      },
      {
        status: 400,
        headers: getCorsHeaders(),
      },
    );
  }

  const authContext = await validateAuthContext(request, {
    accountId: result.data.accountId,
  });

  if (authContext instanceof NextResponse) {
    return authContext;
  }

  return {
    accountId: authContext.accountId,
    name: result.data.name,
    instruction: result.data.instruction,
    organization: result.data.organization,
    image: result.data.image,
    jobTitle: result.data.jobTitle,
    roleType: result.data.roleType,
    companyName: result.data.companyName,
    knowledges: result.data.knowledges,
  };
}
