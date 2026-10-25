import { snapshotFixture } from "@/lib/chat/fence/__tests__/snapshotFixture";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeChatFenceCommand } from "../executeChatFenceCommand";
import { createChatFenceAuthority } from "@/lib/chat/fence/createChatFenceAuthority";
import supabase from "@/lib/supabase/serverClient";
vi.mock("@/lib/supabase/serverClient", () => ({ default: { rpc: vi.fn() } }));
const account = "11111111-1111-4111-8111-111111111111";
const owner = "22222222-2222-4222-8222-222222222222";
const authority = { chatId: "chat", effectiveAccount: account, epoch: 1, owner };
const writer = { epoch: 1, owner, run_id: "wrun-1" };
const bind = {
  action: "bind",
  payload: { ...writer, attempt_id: "55555555-5555-4555-8555-555555555555" },
} as const;
beforeEach(() => vi.clearAllMocks());
describe("disabled, unwired chat fence RPC foundation", () => {
  it("validates and freezes immutable authority", () => {
    const parsed = createChatFenceAuthority(authority);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(() => createChatFenceAuthority({ ...authority, epoch: 0 })).toThrow();
    expect(() => createChatFenceAuthority({ ...authority, runId: "extra" })).toThrow();
    expect(() =>
      createChatFenceAuthority({ ...authority, epoch: Number.MAX_SAFE_INTEGER + 1 }),
    ).toThrow();
  });
  it("sends only the trusted account/chat and exact token to the named RPC", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: { bound: true }, error: null } as never);
    expect(await executeChatFenceCommand("chat", account, bind)).toEqual({
      ok: true,
      action: "bind",
      value: { bound: true },
    });
    expect(supabase.rpc).toHaveBeenCalledExactlyOnceWith("chat_fence_command", {
      p_chat: "chat",
      p_account: account,
      p_action: "bind",
      p: bind.payload,
    });
  });
  it.each([
    ["state", {}, { chat_id: "chat", epoch: 0, phase: "idle", owner: null, run_id: null }],
    [
      "admit",
      snapshotFixture().payload,
      {
        chat_id: "chat",
        request_id: owner,
        input_hash: snapshotFixture().payload.input_hash,
        expected_epoch: 0,
        epoch: 1,
        bound_run_id: "original-run",
        closed: true,
      },
    ],
    [
      "write",
      {
        ...writer,
        id: "u1",
        role: "user",
        mode: "insert",
        parts: { id: "u1", role: "user", parts: [] },
      },
      { written: true, outcome: "exactDuplicate" },
    ],
    [
      "update_parts",
      { ...writer, id: "a1", parts: { id: "a1", role: "assistant", parts: [] } },
      { updated: false },
    ],
    ["release", { ...writer, reason: "workflow_complete" }, { released: false }],
    [
      "delete",
      { request_id: owner, expected_epoch: 1, anchor_id: "u1" },
      { epoch: 2, deleted: 3, request_id: owner },
    ],
  ])("decodes the %s receipt without inventing success", async (action, payload, value) => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: value, error: null } as never);
    expect(await executeChatFenceCommand("chat", account, { action, payload })).toEqual({
      ok: true,
      action,
      value,
    });
  });
  it.each([
    ["40001", "conflict", false],
    ["40P01", "deadlock", true],
    ["42501", "forbidden", false],
    ["55000", "not_enabled", false],
    ["P0002", "not_found", false],
    ["22023", "invalid_command", false],
    ["0A000", "unsupported_isolation", false],
    ["P0001", "invalid_command", false],
    ["unknown", "database_failure", false],
    ["", "transport_ambiguous", false],
    [undefined, "transport_ambiguous", false],
  ])(
    "classifies SQLSTATE %s without retrying or reacquiring authority",
    async (code, kind, retrySameCommand) => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: { code, message: "private input must not leak" },
      } as never);
      expect(await executeChatFenceCommand("chat", account, bind)).toEqual({
        ok: false,
        error: { kind, retrySameCommand },
      });
      expect(supabase.rpc).toHaveBeenCalledTimes(1);
    },
  );
  it("rejects impossible insert-only updated receipts", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: { written: true, outcome: "updated" },
      error: null,
    } as never);
    const command = {
      action: "write",
      payload: {
        ...writer,
        id: "u",
        role: "user",
        mode: "insert",
        parts: { id: "u", role: "user", parts: [] },
      },
    };
    expect(await executeChatFenceCommand("chat", account, command)).toMatchObject({
      ok: false,
      error: { kind: "invalid_receipt" },
    });
  });

  it("rejects own __proto__ message content rather than stripping it before RPC", async () => {
    const command = {
      action: "write",
      payload: {
        ...writer,
        id: "u",
        role: "user",
        mode: "insert",
        parts: {
          id: "u",
          role: "user",
          parts: [],
          metadata: JSON.parse('{"__proto__":{"text":"keep"}}'),
        },
      },
    };
    expect(await executeChatFenceCommand("chat", account, command)).toMatchObject({
      ok: false,
      error: { kind: "invalid_command" },
    });
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("preserves ambiguity on transport rejection without automatic redispatch", async () => {
    vi.mocked(supabase.rpc).mockRejectedValue(new Error("network lost after commit"));
    expect(await executeChatFenceCommand("chat", account, bind)).toEqual({
      ok: false,
      error: { kind: "transport_ambiguous", retrySameCommand: false },
    });
  });
  it.each([{ bound: false }, null, { bound: true, extra: 1 }])(
    "rejects malformed bind success %j",
    async data => {
      vi.mocked(supabase.rpc).mockResolvedValue({ data, error: null } as never);
      expect(await executeChatFenceCommand("chat", account, bind)).toMatchObject({
        ok: false,
        error: { kind: "invalid_receipt" },
      });
    },
  );
  it("rejects a foreign receipt and impossible state", async () => {
    for (const data of [
      { chat_id: "other", epoch: 0, phase: "idle", owner: null, run_id: null },
      { chat_id: "chat", epoch: 1, phase: "running", owner, run_id: null },
    ]) {
      vi.mocked(supabase.rpc).mockResolvedValue({ data, error: null } as never);
      expect(
        await executeChatFenceCommand("chat", account, { action: "state", payload: {} }),
      ).toMatchObject({ ok: false, error: { kind: "invalid_receipt" } });
    }
  });
  it.each([
    { action: "bind", payload: { ...bind.payload, run_id: "pending-owner" } },
    { action: "release", payload: { ...writer, reason: "terminal" } },
    {
      action: "write",
      payload: {
        ...writer,
        id: "u1",
        role: "user",
        mode: "upsert",
        parts: { id: "different", role: "user", parts: [] },
      },
    },
    {
      action: "admit",
      payload: { request_id: owner, expected_epoch: 0, input_hash: "G".repeat(64) },
    },
  ])("rejects invalid commands before I/O", async command => {
    expect(await executeChatFenceCommand("chat", account, command)).toMatchObject({
      ok: false,
      error: { kind: "invalid_command" },
    });
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});
