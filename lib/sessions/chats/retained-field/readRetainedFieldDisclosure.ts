export type RetainedFieldDisclosureScope = {
  actorAccountId: string;
  sessionId: string;
  chatId: string;
  messageId: string;
};
/**
 * No reviewed current-authority transport exists. This boundary cannot grant disclosure.
 * The saved message is untrusted source selection/projection, never an authority receipt.
 * No network, latest selection, re-key, retain, expansion or cached-ready fallback.
 */
export async function readRetainedFieldDisclosure(
  _scope: RetainedFieldDisclosureScope,
  _savedMessage: unknown,
): Promise<{ state: "unavailable" | "error" }> {
  return { state: "unavailable" };
}
