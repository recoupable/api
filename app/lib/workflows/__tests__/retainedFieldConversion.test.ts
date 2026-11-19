import { it, expect, vi } from "vitest";
import { FatalError } from "workflow";
import { convertMessagesStep } from "../convertMessagesStep";
import { routeChatModelStep } from "../routeChatModelStep";
const mocks = vi.hoisted(() => ({ convert: vi.fn(), route: vi.fn() }));
vi.mock("ai", () => ({ convertToModelMessages: mocks.convert }));
vi.mock("@/lib/ai/routing/selectChatModel", () => ({ selectChatModel: mocks.route }));
it.each(["conversion", "routing"])(
  "rejects marked input before actual %s step effects",
  async boundary => {
    const messages = [
      {
        id: "private",
        role: "assistant",
        metadata: { mode: "retained_field" },
        parts: [
          { type: "text", text: "PRIVATE" },
          { type: "file", url: "https://download.invalid/private", mediaType: "text/plain" },
        ],
      },
    ] as never;
    const getWriter = vi.fn();
    await expect(
      boundary === "conversion"
        ? convertMessagesStep(messages)
        : routeChatModelStep(messages, { getWriter } as never),
    ).rejects.toBeInstanceOf(FatalError);
    expect(mocks.convert).not.toHaveBeenCalled();
    expect(mocks.route).not.toHaveBeenCalled();
    expect(getWriter).not.toHaveBeenCalled();
  },
);
