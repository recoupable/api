import { z } from "zod";

const status = z.literal("error").describe("Always `error`.");
const error = z.string().describe("Human-readable error message or documented error code.");
const message = z.string().describe("Human-readable authentication error message.");

const errorResponseSchema = z.looseObject({ status, error });
const messageErrorResponseSchema = z.looseObject({ status, message });

export const errorResponseSchemas = {
  ErrorResponse: errorResponseSchema,
  MessageErrorResponse: messageErrorResponseSchema,
  AuthenticationErrorResponse: z.union([errorResponseSchema, messageErrorResponseSchema]),
};

export type ErrorResponseBody = z.infer<typeof errorResponseSchema>;
export type MessageErrorResponseBody = z.infer<typeof messageErrorResponseSchema>;
