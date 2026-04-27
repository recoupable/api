import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

/**
 * Convert a Zod schema (or pass-through a plain JSON Schema object) into a
 * canonical JSON Schema document suitable for returning over HTTP.
 *
 * Composio's VercelProvider hands tools' `inputSchema` back as live Zod
 * schema instances — serializing those directly leaks `_def`, `~standard`,
 * and other Zod internals into responses. This helper detects Zod schemas
 * via the `_def` marker and routes them through the right converter:
 *
 * - Zod v4 schemas (via our top-level `zod@^4`) use the built-in
 *   `z.toJSONSchema()`.
 * - Zod v3 schemas (which Composio bundles internally) use
 *   `zod-to-json-schema`.
 *
 * Non-Zod inputs pass through unchanged so a future provider that already
 * returns JSON Schema works without code changes.
 *
 * @param input - The value to coerce (typically `tool.inputSchema` from Composio)
 * @returns A JSON Schema object, or `{}` when input is null/undefined or unrecognized
 */
export function toJsonSchema(input: unknown): Record<string, unknown> {
  if (input === null || input === undefined) {
    return {};
  }

  if (typeof input !== "object") {
    return {};
  }

  // Zod schemas carry a `_def` property. v4 has `_def.type`; v3 has
  // `_def.typeName`. Try v4 first, then v3, then bail.
  if ("_def" in input) {
    const def = (input as { _def: Record<string, unknown> })._def;

    if ("type" in def) {
      try {
        return z.toJSONSchema(input as z.ZodTypeAny) as Record<string, unknown>;
      } catch {
        // Fall through to v3 attempt.
      }
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return zodToJsonSchema(input as any) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  // Plain JSON Schema object — pass through.
  return input as Record<string, unknown>;
}
