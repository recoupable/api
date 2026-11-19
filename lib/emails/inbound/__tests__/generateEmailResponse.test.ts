import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateEmailResponse } from "../generateEmailResponse";
import type { ChatRequestBody } from "@/lib/chat/validateChatRequest";

import getGeneralAgent from "@/lib/agents/generalAgent/getGeneralAgent";
import selectMemories from "@/lib/supabase/memories/selectMemories";
import { selectRoomWithArtist } from "@/lib/supabase/rooms/selectRoomWithArtist";
import { FatalError } from "workflow";

vi.mock("@/lib/agents/generalAgent/getGeneralAgent", () => ({
  default: vi.fn(),
}));

vi.mock("@/lib/supabase/memories/selectMemories", () => ({
  default: vi.fn(),
}));

vi.mock("@/lib/emails/getEmailFooter", () => ({
  getEmailFooter: vi.fn(() => "<footer>footer</footer>"),
}));

vi.mock("@/lib/supabase/rooms/selectRoomWithArtist", () => ({
  selectRoomWithArtist: vi.fn(() => ({ artist_name: "Test Artist" })),
}));

const mockGenerate = vi.fn();

describe("generateEmailResponse", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(getGeneralAgent).mockResolvedValue({
      agent: { generate: mockGenerate },
    } as unknown as Awaited<ReturnType<typeof getGeneralAgent>>);

    mockGenerate.mockResolvedValue({ text: "Hello from assistant" });
  });

  it("throws when roomId is missing", async () => {
    const body = { accountId: "acc-1", orgId: null, messages: [] } as ChatRequestBody;

    await expect(generateEmailResponse(body)).rejects.toThrow(
      "roomId is required to generate email response HTML",
    );
  });

  it("generates response with text and footer", async () => {
    vi.mocked(selectMemories).mockResolvedValue([
      { content: { role: "user", parts: [{ type: "text", text: "Hi there" }] } },
      { content: { role: "assistant", parts: [{ type: "text", text: "Earlier reply" }] } },
    ] as never);

    const body: ChatRequestBody = {
      accountId: "acc-1",
      orgId: null,
      messages: [],
      roomId: "room-1",
    };

    const result = await generateEmailResponse(body);

    expect(mockGenerate).toHaveBeenCalledWith({
      messages: [
        { role: "user", content: "Hi there" },
        { role: "assistant", content: "Earlier reply" },
      ],
    });
    expect(selectMemories).toHaveBeenCalledExactlyOnceWith("room-1", { ascending: true });
    expect(getGeneralAgent).toHaveBeenCalledExactlyOnceWith(body);
    expect(selectRoomWithArtist).toHaveBeenCalledExactlyOnceWith("room-1");
    expect(result.text).toBe("Hello from assistant");
    expect(result.html).toContain("Hello from assistant");
    expect(result.html).toContain("<footer>footer</footer>");
  });
  it.each(["part", "metadata"])(
    "denies raw email history with a %s marker before text adaptation",
    async location => {
      const marker = { type: "data-retained-field-projection", private: "MARKER-SECRET" };
      const content = {
        role: "assistant",
        parts: [
          ...(location === "part" ? [marker] : []),
          { type: "text", text: "PRIVATE-SIBLING-987654321" },
        ],
        ...(location === "metadata"
          ? { metadata: { contract: "catalog-retained-field-projection/v1" } }
          : {}),
      };
      const memories = [{ content }];
      const original = structuredClone(memories);
      vi.mocked(selectMemories).mockResolvedValue(memories as never);
      const body = {
        accountId: "authenticated-account",
        orgId: "authenticated-org",
        roomId: "authorized-room",
        messages: [],
      } as ChatRequestBody;
      const result = generateEmailResponse(body);
      await expect(result).rejects.toBeInstanceOf(FatalError);
      await expect(result).rejects.toThrow(/^Retained-field model input unavailable$/);
      expect(mockGenerate).not.toHaveBeenCalled();
      expect(selectRoomWithArtist).not.toHaveBeenCalled();
      expect(selectMemories).toHaveBeenCalledExactlyOnceWith("authorized-room", {
        ascending: true,
      });
      expect(getGeneralAgent).toHaveBeenCalledExactlyOnceWith(body);
      expect(memories).toEqual(original);
    },
  );
});
