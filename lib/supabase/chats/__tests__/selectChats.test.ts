import { beforeEach, describe, expect, it, vi } from "vitest";
import { selectChats } from "@/lib/supabase/chats/selectChats";
const query = vi.hoisted(() => ({ select: vi.fn(), eq: vi.fn(), then: vi.fn() }));
vi.mock("@/lib/supabase/serverClient", () => ({ default: { from: vi.fn(() => query) } }));
beforeEach(() => {
  vi.clearAllMocks();
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
});
function result(data: unknown, error: unknown) {
  query.then.mockImplementation(resolve => resolve({ data, error }));
}
describe("selectChats read outcomes", () => {
  it("preserves failure as null instead of an empty successful read", async () => {
    result(null, { message: "synthetic outage" });
    expect(await selectChats({ id: "synthetic-chat" })).toBeNull();
  });
  it("preserves a successful empty result", async () => {
    result([], null);
    expect(await selectChats()).toEqual([]);
  });
  it("returns rows and applies both filters", async () => {
    result([{ id: "synthetic-chat" }], null);
    expect(await selectChats({ id: "synthetic-chat", sessionId: "synthetic-session" })).toEqual([
      { id: "synthetic-chat" },
    ]);
    expect(query.eq.mock.calls).toEqual([
      ["id", "synthetic-chat"],
      ["session_id", "synthetic-session"],
    ]);
  });
});
