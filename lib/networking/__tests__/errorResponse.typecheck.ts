import type { ErrorResponseBody, MessageErrorResponseBody } from "../errorResponseSchemas";

const _error: ErrorResponseBody = { status: "error", error: "Not found", missing_fields: [] };
const _message: MessageErrorResponseBody = { status: "error", message: "Unauthorized" };

// @ts-expect-error The error envelope always requires its error field.
const _missingError: ErrorResponseBody = { status: "error" };
// @ts-expect-error The authentication envelope always requires its message field.
const _missingMessage: MessageErrorResponseBody = { status: "error" };
// @ts-expect-error A successful response cannot use an error envelope.
const _wrongStatus: ErrorResponseBody = { status: "success", error: "Not found" };
