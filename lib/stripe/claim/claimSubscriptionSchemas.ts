import { z } from "zod";

/** Body for `POST /api/subscriptions/claim` (OpenAPI `ClaimSubscriptionRequest`). */
export const claimSubscriptionBodySchema = z
  .object({
    session_id: z.string().min(1, "session_id is required"),
  })
  .strict();
