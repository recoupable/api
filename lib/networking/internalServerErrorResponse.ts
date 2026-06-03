import { errorResponse } from "@/lib/networking/errorResponse";

/**
 * Standard 500 response for transient backend/query failures.
 */
export function internalServerErrorResponse() {
  return errorResponse("Internal server error", 500);
}
