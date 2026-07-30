import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { handleStartChatRun } from "@/lib/chat/runs/handleStartChatRun";
import { validateChatRunRequest } from "@/lib/chat/runs/validateChatRunRequest";
import { provisionRunSession } from "@/lib/chat/runs/provisionRunSession";
import { mintEphemeralAccountKey } from "@/lib/keys/mintEphemeralAccountKey";
import { deleteApiKey } from "@/lib/supabase/account_api_keys/deleteApiKey";
import { buildRunAgentInput } from "@/lib/chat/buildRunAgentInput";
import { start } from "workflow/api";
import { alertZombieOwner } from "@/lib/chat/runs/alertZombieOwner";

// `after()` schedules post-response work; run the callback synchronously in tests.
vi.mock("next/server", async importOriginal => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, after: (fn: () => unknown) => fn() };
});
vi.mock("@/lib/chat/runs/alertZombieOwner", () => ({
  alertZombieOwner: vi.fn(),
}));
vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));
vi.mock("@/lib/chat/runs/validateChatRunRequest", () => ({
  validateChatRunRequest: vi.fn(),
}));
vi.mock("@/lib/chat/runs/provisionRunSession", () => ({
  provisionRunSession: vi.fn(),
}));
vi.mock("@/lib/keys/mintEphemeralAccountKey", () => ({
  mintEphemeralAccountKey: vi.fn(),
}));
vi.mock("@/lib/supabase/account_api_keys/deleteApiKey", () => ({
  deleteApiKey: vi.fn(async () => ({ error: null })),
}));
vi.mock("@/lib/chat/buildRunAgentInput", () => ({
  buildRunAgentInput: vi.fn(x => ({ built: true, ...x })),
}));
vi.mock("workflow/api", () => ({
  start: vi.fn(),
}));
vi.mock("@/app/lib/workflows/runAgentWorkflow", () => ({ runAgentWorkflow: vi.fn() }));

const req = () =>
  new NextRequest("https://x.test/api/chat/generate", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": "recoup_sk_test" },
    body: JSON.stringify({ prompt: "go" }),
  });

const validated = {
  accountId: "acc-1",
  orgId: null,
  messages: [{ id: "m1", role: "user", parts: [{ type: "text", text: "go" }] }],
  artistId: undefined,
  modelId: "anthropic/claude-haiku-4.5",
};

const provisioned = {
  session: {
    id: "sess-1",
    clone_url: "https://github.com/recoupable/acc-1",
    title: "Scheduled generation",
  },
  chat: { id: "chat-1" },
  sandboxState: { type: "vercel", sandboxName: "session-sess-1" },
  workingDirectory: "/vercel/sandbox",
  skills: [],
};

describe("handleStartChatRun", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateChatRunRequest).mockResolvedValue(validated as never);
    vi.mocked(provisionRunSession).mockResolvedValue(provisioned as never);
    vi.mocked(mintEphemeralAccountKey).mockResolvedValue({
      rawKey: "recoup_sk_raw",
      keyId: "key-1",
    });
    vi.mocked(start).mockResolvedValue({ runId: "wrun_abc" } as never);
  });

  it("provisions, mints, starts the workflow, and returns 202 { runId }", async () => {
    const res = await handleStartChatRun(req());
    expect(res.status).toBe(202);
    expect(res.headers.get("Location")).toBe("/api/chat/runs/wrun_abc");
    expect(await res.json()).toEqual({
      runId: "wrun_abc",
      chatId: "chat-1",
      sessionId: "sess-1",
    });

    expect(provisionRunSession).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: "acc-1", title: "Scheduled generation" }),
    );
    // the minted key is injected as recoupAccessToken AND threaded as ephemeralKeyId
    expect(buildRunAgentInput).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "chat-1",
        sessionId: "sess-1",
        recoupAccessToken: "recoup_sk_raw",
        ephemeralKeyId: "key-1",
      }),
    );
    expect(start).toHaveBeenCalledOnce();
    // key is NOT deleted here — the workflow's finally owns that on run end
    expect(deleteApiKey).not.toHaveBeenCalled();
  });

  it("fires the zombie-owner alert (alert-only) for the run's owner after starting", async () => {
    const res = await handleStartChatRun(req());

    expect(res.status).toBe(202);
    expect(alertZombieOwner).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: "acc-1", chatId: "chat-1", sessionId: "sess-1" }),
    );
  });

  it("does not block the run when the zombie-owner alert throws", async () => {
    vi.mocked(alertZombieOwner).mockRejectedValueOnce(new Error("alert boom"));

    const res = await handleStartChatRun(req());

    expect(res.status).toBe(202);
  });

  it("returns the validation error short-circuit", async () => {
    vi.mocked(validateChatRunRequest).mockResolvedValue(
      NextResponse.json({ status: "error" }, { status: 401 }),
    );
    const res = await handleStartChatRun(req());
    expect(res.status).toBe(401);
    expect(provisionRunSession).not.toHaveBeenCalled();
  });

  it("revokes the minted key and 500s when start() fails", async () => {
    vi.mocked(start).mockRejectedValue(new Error("workflow start boom"));
    const res = await handleStartChatRun(req());
    expect(res.status).toBe(500);
    expect(deleteApiKey).toHaveBeenCalledWith("key-1");
  });

  it("does not mint or delete a key when provisioning fails", async () => {
    vi.mocked(provisionRunSession).mockRejectedValue(new Error("repo boom"));
    const res = await handleStartChatRun(req());
    expect(res.status).toBe(500);
    expect(mintEphemeralAccountKey).not.toHaveBeenCalled();
    expect(deleteApiKey).not.toHaveBeenCalled();
  });
});
