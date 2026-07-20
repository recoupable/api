import { describe, it, expect, vi, beforeEach } from "vitest";

const mockMaybeSingle = vi.fn();
const mockLimit = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockLike = vi.fn(() => ({ limit: mockLimit }));
const mockEqStatus = vi.fn(() => ({ like: mockLike }));
const mockEqAccount = vi.fn(() => ({ eq: mockEqStatus }));
const mockSelect = vi.fn(() => ({ eq: mockEqAccount }));
const mockFrom = vi.fn((_table: string) => ({ select: mockSelect }));

vi.mock("../../serverClient", () => ({
  default: { from: (table: string) => mockFrom(table) },
}));

const { selectWelcomeEmailLog } = await import("../selectWelcomeEmailLog");

describe("selectWelcomeEmailLog", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("queries email_send_log for a sent welcome email of the account", async () => {
    await selectWelcomeEmailLog("acc-1");

    expect(mockFrom).toHaveBeenCalledWith("email_send_log");
    expect(mockEqAccount).toHaveBeenCalledWith("account_id", "acc-1");
    expect(mockEqStatus).toHaveBeenCalledWith("status", "sent");
    expect(mockLike).toHaveBeenCalledWith("raw_body", '%"type":"welcome_email"%');
    expect(mockLimit).toHaveBeenCalledWith(1);
  });

  it("returns the matching row when a welcome email was already sent", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: "log-1" }, error: null });

    const result = await selectWelcomeEmailLog("acc-1");

    expect(result).toEqual({ id: "log-1" });
  });

  it("returns null when no welcome email has been sent", async () => {
    const result = await selectWelcomeEmailLog("acc-1");

    expect(result).toBeNull();
  });

  it("returns null and logs on database error", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: "boom" } });

    const result = await selectWelcomeEmailLog("acc-1");

    expect(result).toBeNull();
    expect(errorSpy).toHaveBeenCalled();
  });
});
