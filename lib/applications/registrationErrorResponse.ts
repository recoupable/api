import { ZodError } from "zod";
import { ApplicationRegistrationError } from "./ApplicationRegistrationError";
/** Stable errors shared by HTTP and MCP; infrastructure details never enter the response. */
export function registrationErrorResponse(error: unknown) {
  return {
    status:
      error instanceof ZodError
        ? 400
        : error instanceof ApplicationRegistrationError
          ? error.status
          : 503,
    error:
      error instanceof ZodError
        ? "Invalid application registration input"
        : error instanceof ApplicationRegistrationError
          ? error.message
          : "Could not validate application registration",
  };
}
