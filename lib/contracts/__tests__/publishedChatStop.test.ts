import Ajv from "ajv";
import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/chat/[chatId]/stop/route";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { selectChats } from "@/lib/supabase/chats/selectChats";
import { selectSessions } from "@/lib/supabase/sessions/selectSessions";
import { compareAndSetChatActiveStreamId } from "@/lib/chat/compareAndSetChatActiveStreamId";
import { waitForTerminalRunStatus } from "@/lib/chat/waitForTerminalRunStatus";
import { getRun } from "workflow/api";
import fixture from "../fixtures/published-docs.json";

vi.mock("@/lib/supabase/serverClient", () => ({ default: {} }));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/supabase/chats/selectChats", () => ({ selectChats: vi.fn() }));
vi.mock("@/lib/supabase/sessions/selectSessions", () => ({ selectSessions: vi.fn() }));
vi.mock("@/lib/chat/compareAndSetChatActiveStreamId", () => ({
  compareAndSetChatActiveStreamId: vi.fn(),
}));
vi.mock("@/lib/chat/waitForTerminalRunStatus", () => ({ waitForTerminalRunStatus: vi.fn() }));
vi.mock("workflow/api", () => ({ getRun: vi.fn() }));

const chatId = "11111111-1111-4111-8111-111111111111";
const sessionId = "22222222-2222-4222-8222-222222222222";
const accountId = "33333333-3333-4333-8333-333333333333";
const cancel = vi.fn();
const ajv = new Ajv({ allErrors: true });
ajv.addKeyword({ keyword: "example", valid: true });

function mockSlot(activeStreamId: string | null) {
  vi.mocked(selectChats).mockResolvedValue([
    { id: chatId, session_id: sessionId, active_stream_id: activeStreamId } as never,
  ]);
}

async function stop() {
  return POST(new NextRequest(`https://api.example/api/chat/${chatId}/stop`, { method: "POST" }), {
    params: Promise.resolve({ chatId }),
  });
}

function responseContract(status: number) {
  const response = fixture.responseSchemas.find(
    item =>
      item.method === "POST" && item.path === "/api/chat/{chatId}/stop" && item.status === status,
  );
  expect(response, `Missing Stop ${status} response contract`).toBeDefined();
  return ajv.compile(response!.schema);
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(validateAuthContext).mockResolvedValue({
    accountId,
    orgId: null,
    authToken: "synthetic",
  });
  vi.mocked(selectSessions).mockResolvedValue([{ id: sessionId, account_id: accountId } as never]);
  mockSlot("wrun_existing");
  cancel.mockResolvedValue(undefined);
  vi.mocked(getRun).mockReturnValue({ cancel } as never);
  vi.mocked(waitForTerminalRunStatus).mockResolvedValue(true);
  vi.mocked(compareAndSetChatActiveStreamId).mockResolvedValue({ ok: true, claimed: true });
});

describe("published Stop responses against the canonical route", () => {
  it.each([null, "wrun_existing"])(
    "binds the no-active/confirmed result for %s to 200",
    async slot => {
      mockSlot(slot);
      const response = await stop();
      expect(response.status).toBe(200);
      const body = await response.json();
      const validate = responseContract(200);
      expect(validate(body), JSON.stringify(validate.errors)).toBe(true);
      expect(body).toEqual({ success: true, stopped: slot !== null });
      expect(cancel).toHaveBeenCalledTimes(slot === null ? 0 : 1);
      expect(compareAndSetChatActiveStreamId).toHaveBeenCalledTimes(slot === null ? 0 : 1);
    },
  );

  it("binds pending-start Stop to retryable 503 without releasing its reservation", async () => {
    mockSlot("pending-synthetic");
    const response = await stop();
    expect(response.status).toBe(503);
    const body = await response.json();
    const validate = responseContract(503);
    expect(validate(body), JSON.stringify(validate.errors)).toBe(true);
    expect(body).not.toHaveProperty("stopped");
    expect(
      fixture.responseSchemas.find(
        item => item.path === "/api/chat/{chatId}/stop" && item.status === 503,
      ),
    ).toHaveProperty("examples.pendingStart", body);
    expect(cancel).not.toHaveBeenCalled();
    expect(waitForTerminalRunStatus).not.toHaveBeenCalled();
    expect(compareAndSetChatActiveStreamId).not.toHaveBeenCalled();
  });

  it.each([502, 504])("binds Stop failure %s while retaining the active slot", async status => {
    if (status === 502) cancel.mockRejectedValue(new Error("synthetic cancellation failure"));
    else vi.mocked(waitForTerminalRunStatus).mockResolvedValue(false);
    const response = await stop();
    expect(response.status).toBe(status);
    const validate = responseContract(status);
    expect(validate(await response.json()), JSON.stringify(validate.errors)).toBe(true);
    expect(compareAndSetChatActiveStreamId).not.toHaveBeenCalled();
  });

  it("keeps authentication failure ahead of cancellation", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ status: "error", error: "Forbidden" }, { status: 403 }),
    );
    expect((await stop()).status).toBe(403);
    expect(selectChats).not.toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
    expect(compareAndSetChatActiveStreamId).not.toHaveBeenCalled();
  });
});
