import { describe, it, expect, vi, beforeEach } from "vitest";
import { selectAccountIdsBySocialId } from "../selectAccountIdsBySocialId";

import supabase from "../../serverClient";

vi.mock("../../serverClient", () => {
  const mockFrom = vi.fn();
  return {
    default: { from: mockFrom },
  };
});

function mockBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, ReturnType<typeof vi.fn>> & {
    then?: (resolve: (v: unknown) => void) => void;
  } = {} as never;
  for (const method of ["select", "eq"]) {
    builder[method] = vi.fn().mockReturnValue(builder);
  }
  builder.then = resolve => resolve(result);
  vi.mocked(supabase.from).mockReturnValue(builder as never);
  return builder;
}

describe("selectAccountIdsBySocialId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns account ids linked to the social", async () => {
    const builder = mockBuilder({
      data: [{ account_id: "acct-1" }, { account_id: "acct-2" }],
      error: null,
    });

    const result = await selectAccountIdsBySocialId("social-123");

    expect(supabase.from).toHaveBeenCalledWith("account_socials");
    expect(builder.select).toHaveBeenCalledWith("account_id");
    expect(builder.eq).toHaveBeenCalledWith("social_id", "social-123");
    expect(result).toEqual(["acct-1", "acct-2"]);
  });

  it("returns empty array when no rows", async () => {
    mockBuilder({ data: [], error: null });
    const result = await selectAccountIdsBySocialId("social-none");
    expect(result).toEqual([]);
  });

  it("throws on db error", async () => {
    mockBuilder({ data: null, error: { message: "boom" } });
    await expect(selectAccountIdsBySocialId("social-x")).rejects.toThrow("boom");
  });
});
