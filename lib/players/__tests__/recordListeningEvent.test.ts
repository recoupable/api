import { beforeEach, expect, it, vi } from "vitest";
import { recordListeningEvent } from "../recordListeningEvent";
const m = vi.hoisted(() => ({ session: vi.fn(), record: vi.fn(), limit: vi.fn() }));
vi.mock("../requirePlayerSession", () => ({ requirePlayerSession: m.session }));
vi.mock("@/lib/supabase/player_listening_events/insertPlayerListeningEvent", () => ({
  insertPlayerListeningEvent: m.record,
}));
vi.mock("@/lib/sites/activity/limitSiteRequest", () => ({ limitSiteRequest: m.limit }));
beforeEach(() => {
  vi.clearAllMocks();
  m.session.mockResolvedValue({
    context: { sessionId: "session", revision: 1 },
    session: { provider: "spotify" },
  });
});
it("binds events to the signed session and preserves retry deduplication", async () => {
  m.record.mockResolvedValue(false);
  const result = await recordListeningEvent("signed", {
    id: crypto.randomUUID(),
    provider: "spotify",
    event: "playing",
  });
  expect(result).toEqual({ success: true, recorded: false });
  expect(m.record).toHaveBeenCalledWith(
    "session",
    1,
    expect.objectContaining({ event: "playing" }),
  );
});
it("rejects another provider or caller-supplied fan identity", async () => {
  await expect(
    recordListeningEvent("signed", {
      id: crypto.randomUUID(),
      provider: "apple_music",
      event: "playing",
    }),
  ).rejects.toMatchObject({ status: 403 });
  await expect(
    recordListeningEvent("signed", {
      id: crypto.randomUUID(),
      provider: "spotify",
      event: "playing",
      fanId: crypto.randomUUID(),
    }),
  ).rejects.toThrow();
  expect(m.record).not.toHaveBeenCalled();
});
