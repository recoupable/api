import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

export const createNotificationBodySchema = z.object({
  cc: z.array(z.string().email("each 'cc' entry must be a valid email")).default([]).optional(),
  subject: z.string({ message: "subject is required" }).min(1, "subject cannot be empty"),
  text: z.string().optional(),
  html: z.string().default("").optional(),
  headers: z.record(z.string(), z.string()).default({}).optional(),
  room_id: z.string().optional(),
});

export type CreateNotificationBody = z.infer<typeof createNotificationBodySchema>;

/**
 * Validates request body for POST /api/notifications.
 *
 * @param body - The request body
 * @returns A NextResponse with an error if validation fails, or the validated body.
 */
export function validateCreateNotificationBody(body: unknown): NextResponse | CreateNotificationBody {
  const result = createNotificationBodySchema.safeParse(body);

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

  return result.data;
}
