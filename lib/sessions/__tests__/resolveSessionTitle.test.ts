import { describe, it, expect, vi, beforeEach } from "vitest";

import { selectSessionTitlesByAccountId } from "@/lib/supabase/sessions/selectSessionTitlesByAccountId";
import { getRandomCityName } from "@/lib/sessions/getRandomCityName";
import { resolveSessionTitle } from "@/lib/sessions/resolveSessionTitle";

vi.mock("@/lib/supabase/sessions/selectSessionTitlesByAccountId", () => ({
  selectSessionTitlesByAccountId: vi.fn(),
}));
vi.mock("@/lib/sessions/getRandomCityName", () => ({
  getRandomCityName: vi.fn(() => "Anchorage"),
}));

describe("resolveSessionTitle", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses the provided title verbatim when present", async () => {
    const result = await resolveSessionTitle({ providedTitle: "Hello", accountId: "acc-1" });
    expect(result).toBe("Hello");
    expect(selectSessionTitlesByAccountId).not.toHaveBeenCalled();
    expect(getRandomCityName).not.toHaveBeenCalled();
  });

  it("trims whitespace around a provided title", async () => {
    const result = await resolveSessionTitle({ providedTitle: "  Hi  ", accountId: "acc-1" });
    expect(result).toBe("Hi");
  });

  it("falls back to getRandomCityName when no title is provided", async () => {
    vi.mocked(selectSessionTitlesByAccountId).mockResolvedValue(["Berlin", "Paris"]);

    const result = await resolveSessionTitle({ accountId: "acc-1" });

    expect(result).toBe("Anchorage");
    expect(selectSessionTitlesByAccountId).toHaveBeenCalledWith("acc-1");
    expect(vi.mocked(getRandomCityName).mock.calls[0][0]).toEqual(new Set(["Berlin", "Paris"]));
  });

  it("falls back to getRandomCityName when title is whitespace-only", async () => {
    vi.mocked(selectSessionTitlesByAccountId).mockResolvedValue([]);

    const result = await resolveSessionTitle({ providedTitle: "   ", accountId: "acc-1" });

    expect(result).toBe("Anchorage");
    expect(selectSessionTitlesByAccountId).toHaveBeenCalledWith("acc-1");
  });
});
