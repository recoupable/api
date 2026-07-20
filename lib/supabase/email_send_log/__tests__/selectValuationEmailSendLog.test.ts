import { describe, it, expect, vi, beforeEach } from "vitest";
import { selectValuationEmailSendLog } from "../selectValuationEmailSendLog";
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

describe("selectValuationEmailSendLog", () => {
  beforeEach(() => vi.clearAllMocks());

  it("matches sent rows carrying this snapshot's marker", async () => {
    const rows = [{ id: "log_1", status: "sent" }];
    const builder = mockBuilder({ data: rows, error: null });

    const result = await selectValuationEmailSendLog("snap_1");

    expect(supabase.from).toHaveBeenCalledWith("email_send_log");
    expect(builder.eq).toHaveBeenCalledWith("status", "sent");
    expect(builder.like).toHaveBeenCalledWith("raw_body", '%"snapshot_id":"snap_1"%');
    expect(result).toEqual(rows[0]);
  });

  it("returns null when no send is recorded", async () => {
    mockBuilder({ data: [], error: null });
    expect(await selectValuationEmailSendLog("snap_1")).toBeNull();
  });

  it("returns null on error", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockBuilder({ data: null, error: { message: "boom" } });
    expect(await selectValuationEmailSendLog("snap_1")).toBeNull();
    consoleError.mockRestore();
  });
});
