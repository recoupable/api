import { z } from "zod";
import { CREDIT_BILLING_URL } from "@/lib/credits/const";
/** Shared controlled failures and credit recovery for HTTP and native OAuth tools. */
export function getPackOperationError(error: unknown) {
  const message =
    error instanceof z.ZodError
      ? error.issues[0]?.message
      : error instanceof SyntaxError
        ? "Invalid JSON request"
        : error instanceof Error
          ? error.message
          : "Pack operation failed";
  const httpStatus = /Insufficient credits/i.test(message)
    ? 402
    : /access denied|ownership mismatch/i.test(message)
      ? 403
      : /not found|query returned no rows/i.test(message)
        ? 404
        : /revision|quote|already|running|uncertain|expired|budget|produced|refill|not enabled|unavailable/i.test(
              message,
            )
          ? 409
          : 400;
  return {
    httpStatus,
    body: {
      success: false,
      status: "error" as const,
      error: message,
      ...(httpStatus === 402 ? { billingUrl: CREDIT_BILLING_URL } : {}),
    },
  };
}
