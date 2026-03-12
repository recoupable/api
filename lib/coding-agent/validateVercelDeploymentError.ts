import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

export const vercelDeploymentErrorSchema = z.object({
  type: z.literal("deployment.error"),
  id: z.string(),
  createdAt: z.number(),
  payload: z.object({
    team: z
      .object({
        id: z.string(),
      })
      .nullable()
      .optional(),
    user: z.object({
      id: z.string(),
    }),
    deployment: z.object({
      id: z.string(),
      url: z.string(),
      name: z.string(),
      meta: z.record(z.string(), z.unknown()).optional(),
    }),
    links: z
      .object({
        deployment: z.string().optional(),
        project: z.string().optional(),
      })
      .optional(),
    target: z.string().nullable().optional(),
    project: z.object({
      id: z.string(),
    }),
  }),
});

export type VercelDeploymentError = z.infer<typeof vercelDeploymentErrorSchema>;

/**
 * Validates a Vercel deployment.error webhook payload.
 *
 * @param body - The parsed webhook body
 * @returns A NextResponse with an error if validation fails, or the validated payload.
 */
export function validateVercelDeploymentError(body: unknown): NextResponse | VercelDeploymentError {
  const result = vercelDeploymentErrorSchema.safeParse(body);

  if (!result.success) {
    const firstError = result.error.issues[0];
    return NextResponse.json(
      {
        status: "error",
        error: firstError.message,
      },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  return result.data;
}
