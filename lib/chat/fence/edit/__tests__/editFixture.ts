import { workflowInput, policy, account } from "../../__tests__/snapshotFixture";
export function editFixture() {
  return {
    deletion: {
      chatId: "chat",
      effectiveAccount: account,
      expectedEpoch: 1,
      requestId: "55555555-5555-4555-8555-555555555555",
      anchorId: "old-user",
    },
    workflowInput: {
      ...structuredClone(workflowInput),
      messages: [
        {
          id: "prefix-user",
          role: "user" as const,
          parts: [{ type: "text" as const, text: "prefix" }],
        },
        {
          id: "prefix-assistant",
          role: "assistant" as const,
          parts: [{ type: "text" as const, text: "prefix answer" }],
        },
        { id: "old-user", role: "user" as const, parts: [{ type: "text" as const, text: "old" }] },
        {
          id: "old-assistant",
          role: "assistant" as const,
          parts: [{ type: "text" as const, text: "old answer" }],
        },
      ],
    },
    editedUserMessage: {
      id: "old-user",
      role: "user" as const,
      parts: [{ type: "text" as const, text: "edited" }],
      metadata: { origin: "edit" },
    },
    replacementUserId: "fresh-edited-user",
    admissionRequestId: "66666666-6666-4666-8666-666666666666",
    snapshotId: "edited-snapshot",
    tombstonedMessageIds: ["earlier-tombstone"],
    credentialPolicy: structuredClone(policy),
  };
}
