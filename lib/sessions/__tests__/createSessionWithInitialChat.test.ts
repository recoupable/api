import { describe, it, expect, vi, beforeEach } from "vitest";

import { createSessionWithInitialChat } from "@/lib/sessions/createSessionWithInitialChat";
import { ensurePersonalRepo } from "@/lib/recoupable/ensurePersonalRepo";
import { buildSessionInsertRow } from "@/lib/sessions/buildSessionInsertRow";
import { insertSession } from "@/lib/supabase/sessions/insertSession";
import { deleteSessionById } from "@/lib/supabase/sessions/deleteSessionById";
import { insertChat } from "@/lib/supabase/chats/insertChat";

vi.mock("@/lib/uuid/generateUUID", () => ({ generateUUID: vi.fn(() => "chat-uuid") }));
vi.mock("@/lib/recoupable/ensurePersonalRepo", () => ({ ensurePersonalRepo: vi.fn() }));
vi.mock("@/lib/sessions/buildSessionInsertRow", () => ({
  buildSessionInsertRow: vi.fn(x => ({ row: true, ...x })),
}));
vi.mock("@/lib/supabase/sessions/insertSession", () => ({ insertSession: vi.fn() }));
vi.mock("@/lib/supabase/sessions/deleteSessionById", () => ({ deleteSessionById: vi.fn() }));
vi.mock("@/lib/supabase/chats/insertChat", () => ({ insertChat: vi.fn() }));

const args = { accountId: "acc-1", title: "T", chatTitle: "New chat", artistId: "art-1" };

describe("createSessionWithInitialChat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ensurePersonalRepo).mockResolvedValue("https://github.com/recoupable/acc-1");
    vi.mocked(insertSession).mockResolvedValue({ id: "sess-1" } as never);
    vi.mocked(insertChat).mockResolvedValue({ id: "chat-1" } as never);
    vi.mocked(deleteSessionById).mockResolvedValue(true as never);
  });

  it("returns { ok, session, chat } on success and builds the row with the resolved clone url", async () => {
    const r = await createSessionWithInitialChat(args);
    expect(r).toEqual({ ok: true, session: { id: "sess-1" }, chat: { id: "chat-1" } });
    expect(buildSessionInsertRow).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "acc-1",
        cloneUrl: "https://github.com/recoupable/acc-1",
      }),
    );
  });

  it("uses workspaceAccountId for the repo when provided", async () => {
    await createSessionWithInitialChat({ ...args, workspaceAccountId: "org-9" });
    expect(ensurePersonalRepo).toHaveBeenCalledWith({ accountId: "org-9" });
  });

  it("returns reason 'repo' when the workspace repo can't be provisioned", async () => {
    vi.mocked(ensurePersonalRepo).mockResolvedValue(null);
    expect(await createSessionWithInitialChat(args)).toEqual({ ok: false, reason: "repo" });
    expect(insertSession).not.toHaveBeenCalled();
  });

  it("returns reason 'insert' when the session insert fails", async () => {
    vi.mocked(insertSession).mockResolvedValue(null as never);
    expect(await createSessionWithInitialChat(args)).toEqual({ ok: false, reason: "insert" });
  });

  it("rolls back the session and returns 'insert' when the chat insert fails", async () => {
    vi.mocked(insertChat).mockResolvedValue(null as never);
    const r = await createSessionWithInitialChat(args);
    expect(r).toEqual({ ok: false, reason: "insert" });
    expect(deleteSessionById).toHaveBeenCalledWith("sess-1");
  });
});
