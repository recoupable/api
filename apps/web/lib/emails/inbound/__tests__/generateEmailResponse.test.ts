import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateEmailResponse } from "../generateEmailResponse";
import type { ChatRequestBody } from "@/lib/chat/validateChatRequest";

import getGeneralAgent from "@/lib/agents/generalAgent/getGeneralAgent";
import { getEmailRoomMessages } from "@/lib/emails/inbound/getEmailRoomMessages";

vi.mock("@/lib/agents/generalAgent/getGeneralAgent", () => ({
  default: vi.fn(),
}));

vi.mock("@/lib/emails/inbound/getEmailRoomMessages", () => ({
  getEmailRoomMessages: vi.fn(),
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
    vi.mocked(getEmailRoomMessages).mockResolvedValue([{ role: "user", content: "Hi there" }]);

    const body: ChatRequestBody = {
      accountId: "acc-1",
      orgId: null,
      messages: [],
      roomId: "room-1",
    };

    const result = await generateEmailResponse(body);

    expect(mockGenerate).toHaveBeenCalledWith({
      messages: [{ role: "user", content: "Hi there" }],
    });
    expect(result.text).toBe("Hello from assistant");
    expect(result.html).toContain("Hello from assistant");
    expect(result.html).toContain("<footer>footer</footer>");
  });
});
