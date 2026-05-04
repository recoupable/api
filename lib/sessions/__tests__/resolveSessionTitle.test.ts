import { describe, it, expect, vi, beforeEach } from "vitest";

import { selectSessions } from "@/lib/supabase/sessions/selectSessions";
import { getRandomCityName } from "@/lib/sessions/getRandomCityName";
import { resolveSessionTitle } from "@/lib/sessions/resolveSessionTitle";
import { baseSessionRow } from "@/lib/sessions/__tests__/baseSessionRow";

vi.mock("@/lib/supabase/sessions/selectSessions", () => ({
  selectSessions: vi.fn(),
}));
vi.mock("@/lib/sessions/getRandomCityName", () => ({
  getRandomCityName: vi.fn(() => "Anchorage"),
}));

describe("resolveSessionTitle", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses the provided title verbatim when present", async () => {
    const result = await resolveSessionTitle({ providedTitle: "Hello", accountId: "acc-1" });
    expect(result).toBe("Hello");
    expect(selectSessions).not.toHaveBeenCalled();
    expect(getRandomCityName).not.toHaveBeenCalled();
  });

  it("trims whitespace around a provided title", async () => {
    const result = await resolveSessionTitle({ providedTitle: "  Hi  ", accountId: "acc-1" });
    expect(result).toBe("Hi");
  });

  it("falls back to getRandomCityName when no title is provided", async () => {
    vi.mocked(selectSessions).mockResolvedValue([
      baseSessionRow({ title: "Berlin" }),
      baseSessionRow({ id: "sess_2", title: "Paris" }),
    ]);

    const result = await resolveSessionTitle({ accountId: "acc-1" });

    expect(result).toBe("Anchorage");
    expect(selectSessions).toHaveBeenCalledWith({ accountId: "acc-1" });
    expect(vi.mocked(getRandomCityName).mock.calls[0][0]).toEqual(new Set(["Berlin", "Paris"]));
  });

  it("falls back to getRandomCityName when title is whitespace-only", async () => {
    vi.mocked(selectSessions).mockResolvedValue([]);

    const result = await resolveSessionTitle({ providedTitle: "   ", accountId: "acc-1" });

    expect(result).toBe("Anchorage");
    expect(selectSessions).toHaveBeenCalledWith({ accountId: "acc-1" });
  });
});
