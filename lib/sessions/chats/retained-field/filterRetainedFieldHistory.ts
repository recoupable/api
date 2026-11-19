import type { Tables } from "@/types/database.types";
import { hasRetainedFieldContent } from "./hasRetainedFieldContent";
import {
  readRetainedFieldDisclosure,
  type RetainedFieldDisclosureScope,
} from "./readRetainedFieldDisclosure";

/** Withhold the entire stored message, including sibling text, tables and metadata. */
export async function filterRetainedFieldHistory(
  scope: Omit<RetainedFieldDisclosureScope, "messageId">,
  rows: Tables<"chat_messages">[],
): Promise<unknown[]> {
  const messages: unknown[] = [];
  for (const row of rows) {
    if (!hasRetainedFieldContent(row.parts)) {
      messages.push(row.parts);
      continue;
    }
    try {
      await readRetainedFieldDisclosure({ ...scope, messageId: row.id }, row.parts);
    } catch {
      // Operational failure cannot release any projection or existence diagnostics.
    }
    // No positive transport/publication protocol is adopted. Even a surprising
    // cached "ready" result cannot authorize returning stored projections.
  }
  return messages;
}
