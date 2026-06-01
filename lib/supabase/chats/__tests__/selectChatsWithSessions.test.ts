import { describe, it, expect, vi, beforeEach } from "vitest";
import { selectChatsWithSessions } from "@/lib/supabase/chats/selectChatsWithSessions";

const fromMock = vi.fn();
const selectMock = vi.fn();
const neqMock = vi.fn();
const inMock = vi.fn();
const eqMock = vi.fn();
const orderMock = vi.fn();

vi.mock("@/lib/supabase/serverClient", () => ({
  default: {
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  // Default chain: from().select().neq().in().eq().order() -> resolves to { data, error }
  const builder = {
    select: selectMock,
    neq: neqMock,
    in: inMock,
    eq: eqMock,
    order: orderMock,
  };
  fromMock.mockReturnValue(builder);
  selectMock.mockReturnValue(builder);
  neqMock.mockReturnValue(builder);
  inMock.mockReturnValue(builder);
  eqMock.mockReturnValue(builder);
  orderMock.mockResolvedValue({ data: [], error: null });
});

describe("selectChatsWithSessions", () => {
  it("queries chats joined with sessions, filtered by account_ids, ordered by updated_at desc", async () => {
    const rows = [
      {
        id: "chat-1",
        title: "Hello",
        session_id: "sess-1",
        updated_at: "2024-01-02T00:00:00Z",
        session: { id: "sess-1", account_id: "acc-1" },
      },
    ];
    orderMock.mockResolvedValueOnce({ data: rows, error: null });

    const result = await selectChatsWithSessions({ accountIds: ["acc-1", "acc-2"] });

    expect(fromMock).toHaveBeenCalledWith("chats");
    expect(selectMock).toHaveBeenCalledTimes(1);
    const selectArg = selectMock.mock.calls[0]?.[0];
    expect(typeof selectArg).toBe("string");
    expect(String(selectArg)).toContain("session:sessions!inner");
    expect(String(selectArg)).toContain("account_id");
    expect(String(selectArg)).toContain("artist_id");
    expect(String(selectArg)).toContain("status");

    expect(neqMock).toHaveBeenCalledWith("session.status", "archived");
    expect(inMock).toHaveBeenCalledWith("session.account_id", ["acc-1", "acc-2"]);
    expect(eqMock).not.toHaveBeenCalled();
    expect(orderMock).toHaveBeenCalledWith("updated_at", { ascending: false });
    expect(result).toEqual(rows);
  });

  it("always excludes archived sessions, even with no other filters", async () => {
    await selectChatsWithSessions({});

    expect(neqMock).toHaveBeenCalledWith("session.status", "archived");
  });

  it("composes accountIds + artistAccountId — both filters applied", async () => {
    orderMock.mockResolvedValueOnce({ data: [], error: null });

    await selectChatsWithSessions({
      accountIds: ["acc-1"],
      artistAccountId: "artist-9",
    });

    expect(inMock).toHaveBeenCalledWith("session.account_id", ["acc-1"]);
    expect(eqMock).toHaveBeenCalledWith("session.artist_id", "artist-9");
  });

  it("applies the artist filter alone (admin scope + artist)", async () => {
    orderMock.mockResolvedValueOnce({ data: [], error: null });

    await selectChatsWithSessions({ artistAccountId: "artist-9" });

    expect(inMock).not.toHaveBeenCalled();
    expect(eqMock).toHaveBeenCalledWith("session.artist_id", "artist-9");
  });

  it("returns [] without calling .in() when accountIds is undefined (admin: all)", async () => {
    const rows = [
      {
        id: "chat-1",
        title: "Admin",
        session_id: "sess-1",
        updated_at: "2024-01-02T00:00:00Z",
        session: { id: "sess-1", account_id: "acc-1" },
      },
    ];
    orderMock.mockResolvedValueOnce({ data: rows, error: null });

    const result = await selectChatsWithSessions({});

    expect(inMock).not.toHaveBeenCalled();
    expect(orderMock).toHaveBeenCalledWith("updated_at", { ascending: false });
    expect(result).toEqual(rows);
  });

  it("short-circuits to [] when accountIds is an empty array", async () => {
    const result = await selectChatsWithSessions({ accountIds: [] });

    expect(result).toEqual([]);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("returns null on supabase error", async () => {
    orderMock.mockResolvedValueOnce({ data: null, error: { message: "boom" } });

    const result = await selectChatsWithSessions({ accountIds: ["acc-1"] });

    expect(result).toBeNull();
  });

  it("returns [] when supabase returns no data and no error", async () => {
    orderMock.mockResolvedValueOnce({ data: null, error: null });

    const result = await selectChatsWithSessions({ accountIds: ["acc-1"] });

    expect(result).toEqual([]);
  });
});
