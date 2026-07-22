import { describe, it, expect, vi, beforeEach } from "vitest";
import { selectEmailSendLog } from "../selectEmailSendLog";
import supabase from "../../serverClient";

vi.mock("../../serverClient", () => {
  const mockFrom = vi.fn();
  return { default: { from: mockFrom } };
});

function mockBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, ReturnType<typeof vi.fn>> & {
    then?: (resolve: (v: unknown) => void) => void;
  } = {} as never;
  for (const m of ["select", "eq", "like", "limit"]) builder[m] = vi.fn().mockReturnValue(builder);
  builder.then = resolve => resolve(result);
  vi.mocked(supabase.from).mockReturnValue(builder as never);
  return builder;
}

describe("selectEmailSendLog", () => {
  beforeEach(() => vi.clearAllMocks());

  it("applies the status, raw_body-substring, and limit filters", async () => {
    const rows = [{ id: "log_1", status: "sent" }];
    const builder = mockBuilder({ data: rows, error: null });

    const result = await selectEmailSendLog({
      status: "sent",
      rawBodyLike: '"snapshot_id":"snap_1"',
      limit: 1,
    });

    expect(supabase.from).toHaveBeenCalledWith("email_send_log");
    expect(builder.eq).toHaveBeenCalledWith("status", "sent");
    expect(builder.like).toHaveBeenCalledWith("raw_body", '%"snapshot_id":"snap_1"%');
    expect(builder.limit).toHaveBeenCalledWith(1);
    expect(result).toEqual(rows);
  });

  it("skips filters that aren't provided", async () => {
    const builder = mockBuilder({ data: [], error: null });

    await selectEmailSendLog();

    expect(builder.eq).not.toHaveBeenCalled();
    expect(builder.like).not.toHaveBeenCalled();
    expect(builder.limit).not.toHaveBeenCalled();
  });

  it("returns an empty array when nothing matches", async () => {
    mockBuilder({ data: [], error: null });
    expect(await selectEmailSendLog({ status: "sent" })).toEqual([]);
  });

  it("returns an empty array on error", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockBuilder({ data: null, error: { message: "boom" } });
    expect(await selectEmailSendLog({ status: "sent" })).toEqual([]);
    consoleError.mockRestore();
  });
});
