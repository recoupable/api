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

  // Zod schemas expose their internals differently by version:
  //   - zod >= 4.3 puts them on `_zod` and no longer answers to `_def`
  //   - zod 4.0-4.2 uses `_def.type`
  //   - zod v3 (bundled inside Composio) uses `_def.typeName`
  // Missing the `_zod` case made a live schema fall through to the
  // pass-through below, leaking `~standard` and `_zod` into the response.
  const hasModernInternals = "_zod" in input;

  if (hasModernInternals || "_def" in input) {
    const def = ("_def" in input
      ? (input as { _def: Record<string, unknown> })._def
      : undefined) as Record<string, unknown> | undefined;

    if (hasModernInternals || (def && "type" in def)) {
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
