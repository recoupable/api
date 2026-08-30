import { describe, it, expect, vi, beforeEach } from "vitest";
import supabase from "../../serverClient";

vi.mock("../../serverClient", () => ({ default: { from: vi.fn() } }));

const { selectAccountEmail } = await import("../selectAccountEmail");

function mockBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, ReturnType<typeof vi.fn>> & {
    then?: (resolve: (v: unknown) => void) => void;
  } = {} as never;
  for (const m of ["select", "ilike", "limit"]) builder[m] = vi.fn().mockReturnValue(builder);
  builder.then = resolve => resolve(result);
  vi.mocked(supabase.from).mockReturnValue(builder as never);
  return builder;
}

describe("selectAccountEmail", () => {
  beforeEach(() => vi.clearAllMocks());

  it("matches case-insensitively with LIKE wildcards escaped", async () => {
    const builder = mockBuilder({
      data: [{ account_id: "acc_1", email: "Fan@Example.com" }],
      error: null,
    });
    const row = await selectAccountEmail("fan_x@example.com");
    expect(builder.ilike).toHaveBeenCalledWith("email", "fan\\_x@example.com");
    expect(row?.account_id).toBe("acc_1");
  });

  it("returns null on no match or error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockBuilder({ data: [], error: null });
    expect(await selectAccountEmail("a@b.co")).toBeNull();
    mockBuilder({ data: null, error: { message: "x" } });
    expect(await selectAccountEmail("a@b.co")).toBeNull();
  });
});
