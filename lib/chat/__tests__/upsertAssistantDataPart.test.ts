import { describe, it, expect } from "vitest";
import { upsertAssistantDataPart } from "@/lib/chat/upsertAssistantDataPart";

const baseMessage = {
  id: "msg_1",
  role: "assistant" as const,
  parts: [{ type: "text", text: "Hello" }, { type: "step-finish" }] as never[],
};

describe("upsertAssistantDataPart", () => {
  it("appends a new part when no part with the same {type, id} exists", () => {
    const part = {
      type: "data-commit" as const,
      id: "msg_1:commit",
      data: { status: "pending" as const, committed: false, pushed: false },
    };
    const result = upsertAssistantDataPart(baseMessage, part);
    expect(result.parts).toHaveLength(3);
    expect(result.parts[2]).toEqual(part);
  });

  it("replaces the existing part when {type, id} matches (pending → success)", () => {
    const pendingPart = {
      type: "data-commit" as const,
      id: "msg_1:commit",
      data: { status: "pending" as const, committed: false, pushed: false },
    };
    const successPart = {
      type: "data-commit" as const,
      id: "msg_1:commit",
      data: {
        status: "success" as const,
        committed: true,
        pushed: true,
        commitSha: "abc123",
        url: "https://github.com/owner/repo/commit/abc123",
      },
    };
    const afterPending = upsertAssistantDataPart(baseMessage, pendingPart);
    const afterSuccess = upsertAssistantDataPart(afterPending, successPart);
    expect(afterSuccess.parts).toHaveLength(3);
    expect(afterSuccess.parts[2]).toEqual(successPart);
  });

  it("does NOT mutate the input message", () => {
    const part = {
      type: "data-commit" as const,
      id: "msg_1:commit",
      data: { status: "pending" as const, committed: false, pushed: false },
    };
    const result = upsertAssistantDataPart(baseMessage, part);
    expect(baseMessage.parts).toHaveLength(2);
    expect(result.parts).not.toBe(baseMessage.parts);
  });

  it("preserves the other message fields (id, role, etc.)", () => {
    const part = {
      type: "data-commit" as const,
      id: "msg_1:commit",
      data: { status: "pending" as const, committed: false, pushed: false },
    };
    const result = upsertAssistantDataPart(baseMessage, part);
    expect(result.id).toBe(baseMessage.id);
    expect(result.role).toBe(baseMessage.role);
  });

  it("treats different ids as different parts (appends a second one)", () => {
    const partA = {
      type: "data-commit" as const,
      id: "msg_1:commit-a",
      data: { status: "pending" as const, committed: false, pushed: false },
    };
    const partB = {
      type: "data-commit" as const,
      id: "msg_1:commit-b",
      data: { status: "pending" as const, committed: false, pushed: false },
    };
    const result = upsertAssistantDataPart(upsertAssistantDataPart(baseMessage, partA), partB);
    expect(result.parts).toHaveLength(4);
  });
});
