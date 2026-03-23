import { describe, it, expect, vi, beforeEach } from "vitest";
import { getSlackUserInfo } from "../getSlackUserInfo";
import { slackGet } from "../slackGet";

vi.mock("../slackGet", () => ({
  slackGet: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getSlackUserInfo", () => {
  it("returns user ID as name when Slack API returns ok: false", async () => {
    vi.mocked(slackGet).mockResolvedValue({ ok: false, error: "user_not_found" });

    const result = await getSlackUserInfo("token", "U999");

    expect(result).toEqual({ name: "U999", avatar: null });
  });

  it("returns profile data on success", async () => {
    vi.mocked(slackGet).mockResolvedValue({
      ok: true,
      user: {
        id: "U123",
        real_name: "Jane",
        profile: { display_name: "janey", real_name: "Jane Smith", image_48: "https://img.png" },
      },
    });

    const result = await getSlackUserInfo("token", "U123");

    expect(result).toEqual({ name: "janey", avatar: "https://img.png" });
  });
});
