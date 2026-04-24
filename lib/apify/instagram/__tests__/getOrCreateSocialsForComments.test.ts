import { describe, it, expect, vi, beforeEach } from "vitest";
import { getOrCreateSocialsForComments } from "../getOrCreateSocialsForComments";
import { insertSocials } from "@/lib/supabase/socials/insertSocials";

vi.mock("@/lib/supabase/socials/insertSocials", () => ({ insertSocials: vi.fn() }));

describe("getOrCreateSocialsForComments", () => {
  beforeEach(() => vi.clearAllMocks());

  it("upserts one row per distinct commenter and keys result by username", async () => {
    vi.mocked(insertSocials).mockResolvedValue([
      { id: "s1", username: "alice", profile_url: "instagram.com/alice" },
      { id: "s2", username: "bob", profile_url: "instagram.com/bob" },
    ] as never);

    const result = await getOrCreateSocialsForComments([
      {
        id: "c1",
        text: "t",
        timestamp: "2026-01-01",
        ownerUsername: "alice",
        ownerProfilePicUrl: "https://a",
        postUrl: "u1",
      },
      {
        id: "c2",
        text: "t2",
        timestamp: "2026-01-02",
        ownerUsername: "alice",
        ownerProfilePicUrl: "https://a",
        postUrl: "u1",
      },
      {
        id: "c3",
        text: "t3",
        timestamp: "2026-01-03",
        ownerUsername: "bob",
        ownerProfilePicUrl: "https://b",
        postUrl: "u2",
      },
    ]);

    expect(insertSocials).toHaveBeenCalledOnce();
    const [rows] = vi.mocked(insertSocials).mock.calls[0];
    expect(rows).toHaveLength(2);
    expect(result.get("alice")?.id).toBe("s1");
    expect(result.get("bob")?.id).toBe("s2");
  });

  it("propagates DB errors so the webhook handler can log + short-circuit", async () => {
    vi.mocked(insertSocials).mockRejectedValue(new Error("boom"));

    await expect(
      getOrCreateSocialsForComments([
        {
          id: "c1",
          text: "t",
          timestamp: "2026-01-01",
          ownerUsername: "alice",
          ownerProfilePicUrl: "https://a",
          postUrl: "u1",
        },
      ]),
    ).rejects.toThrow("boom");
  });
});
