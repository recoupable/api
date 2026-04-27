import { z } from "zod";

/**
 * Convert a Zod schema (or pass-through a plain JSON Schema object) into a
 * canonical JSON Schema document suitable for returning over HTTP.
 *
 * Composio's VercelProvider hands tools' `inputSchema` back as live Zod
 * schema instances — serializing those directly leaks `_def`, `~standard`,
 * and other Zod internals into responses. This helper detects Zod schemas
 * and runs them through `z.toJSONSchema`; non-Zod inputs are returned
 * unchanged so a future provider that already gives us JSON Schema works
 * without code changes.
 *
 * @param input - The value to coerce (typically `tool.inputSchema` from Composio)
 * @returns A JSON Schema object, or `{}` when input is null/undefined or unrecognized
 */
export function toJsonSchema(input: unknown): Record<string, unknown> {
  if (input === null || input === undefined) {
    return {};
  }

  // Zod schemas carry a `_def` property; try the official converter first.
  if (typeof input === "object" && "_def" in (input as object)) {
    try {
      return z.toJSONSchema(input as z.ZodTypeAny) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  // Plain JSON Schema object — pass through.
  if (typeof input === "object") {
    return input as Record<string, unknown>;
  }

  return {};
}
