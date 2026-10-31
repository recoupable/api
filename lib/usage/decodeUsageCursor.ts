import type { UsageCursor, UsageSort } from "@/lib/usage/usageSort";
import { normalizeUsageTimestamp } from "@/lib/usage/normalizeUsageTimestamp";
import { z } from "zod";

const COST_CURSOR = /^(\d+):([\w-]{1,100})$/;
const timeCursorSchema = z.tuple([
  z.string().datetime({ offset: true }),
  z.string().regex(/^[\w-]{1,100}$/),
]);

/**
 * Parse versioned timestamp/ID tokens, legacy ISO time boundaries, or the
 * existing cost/ID keyset. IDs are restricted to the stored NanoID/UUID alphabet.
 *
 * @param sort - The sort the cursor was issued under.
 * @param cursor - The raw query value.
 * @returns The keyset, or null when the cursor does not fit the sort.
 */
export function decodeUsageCursor(sort: UsageSort, cursor: string): UsageCursor | null {
  if (sort === "cost") {
    const match = COST_CURSOR.exec(cursor);
    return match && Number.isSafeInteger(Number(match[1]))
      ? { creditsDeducted: Number(match[1]), id: match[2] }
      : null;
  }
  if (cursor.startsWith("v1:")) {
    if (!/^v1:[\w-]+$/.test(cursor)) return null;
    try {
      const [createdAt, id] = timeCursorSchema.parse(
        JSON.parse(Buffer.from(cursor.slice(3), "base64url").toString("utf8")),
      );
      return { createdAt: normalizeUsageTimestamp(createdAt), id };
    } catch {
      return null;
    }
  }
  const time = Date.parse(cursor);
  if (Number.isNaN(time) || COST_CURSOR.test(cursor)) return null;
  return { createdAt: normalizeUsageTimestamp(cursor) };
}
