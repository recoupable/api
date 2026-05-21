import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { handleStopChatWorkflow } from "@/lib/chat/handleStopChatWorkflow";
import { validateStopChatWorkflowRequest } from "@/lib/chat/validateStopChatWorkflowRequest";
import { compareAndSetChatActiveStreamId } from "@/lib/chat/compareAndSetChatActiveStreamId";
import { getRun } from "workflow/api";

vi.mock("@/lib/chat/validateStopChatWorkflowRequest", () => ({
  validateStopChatWorkflowRequest: vi.fn(),
}));
vi.mock("@/lib/chat/compareAndSetChatActiveStreamId", () => ({
  compareAndSetChatActiveStreamId: vi.fn(),
}));
vi.mock("workflow/api", () => ({ getRun: vi.fn() }));
vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

const ACCOUNT_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const SESSION_ID = "22222222-2222-2222-2222-222222222222";
const CHAT_ID = "11111111-1111-1111-1111-111111111111";

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/chat/" + CHAT_ID + "/stop", {
    method: "POST",
    headers: { "x-api-key": "test-key" },
  });
}

function mockValidated(activeStreamId: string | null) {
  vi.mocked(validateStopChatWorkflowRequest).mockResolvedValue({
    auth: { accountId: ACCOUNT_ID, orgId: null, authToken: "token" },
    chat: {
      id: CHAT_ID,
      session_id: SESSION_ID,
      active_stream_id: activeStreamId,
      model_id: null,
    } as never,
  });
}

describe("handleStopChatWorkflow", () => {
  const cancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    cancel.mockResolvedValue(undefined);
    vi.mocked(getRun).mockReturnValue({ cancel } as never);
    vi.mocked(compareAndSetChatActiveStreamId).mockResolvedValue({ ok: true, claimed: true });
  });

  it("passes through the validation NextResponse on failure", async () => {
    const forbidden = NextResponse.json({ status: "error" }, { status: 403 });
    vi.mocked(validateStopChatWorkflowRequest).mockResolvedValue(forbidden);

    const result = await handleStopChatWorkflow(makeRequest(), CHAT_ID);

    expect(result).toBe(forbidden);
    expect(vi.mocked(getRun)).not.toHaveBeenCalled();
    expect(vi.mocked(compareAndSetChatActiveStreamId)).not.toHaveBeenCalled();
  });

  it("returns stopped:false without cancelling when no workflow is active", async () => {
    mockValidated(null);

    const result = await handleStopChatWorkflow(makeRequest(), CHAT_ID);

    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ success: true, stopped: false });
    expect(vi.mocked(getRun)).not.toHaveBeenCalled();
    expect(vi.mocked(compareAndSetChatActiveStreamId)).not.toHaveBeenCalled();
  });

  it("cancels the run and releases the slot for a live run id", async () => {
    mockValidated("wrun_abc");

    const result = await handleStopChatWorkflow(makeRequest(), CHAT_ID);

    expect(vi.mocked(getRun)).toHaveBeenCalledWith("wrun_abc");
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(vi.mocked(compareAndSetChatActiveStreamId)).toHaveBeenCalledWith(
      CHAT_ID,
      "wrun_abc",
      null,
    );
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ success: true, stopped: true });
  });

  it("releases the slot without cancelling for a pending placeholder", async () => {
    mockValidated("pending-deterministic-uuid");

    const result = await handleStopChatWorkflow(makeRequest(), CHAT_ID);

    expect(vi.mocked(getRun)).not.toHaveBeenCalled();
    expect(vi.mocked(compareAndSetChatActiveStreamId)).toHaveBeenCalledWith(
      CHAT_ID,
      "pending-deterministic-uuid",
      null,
    );
    expect(await result.json()).toEqual({ success: true, stopped: true });
  });

  it("returns 502 and does NOT release the slot when run cancellation throws", async () => {
    mockValidated("wrun_abc");
    cancel.mockRejectedValue(new Error("cancel failed"));

    const result = await handleStopChatWorkflow(makeRequest(), CHAT_ID);

    expect(result.status).toBe(502);
    expect(vi.mocked(compareAndSetChatActiveStreamId)).not.toHaveBeenCalled();
  });

  it("reports success even when the release CAS loses the race", async () => {
    mockValidated("wrun_abc");
    vi.mocked(compareAndSetChatActiveStreamId).mockResolvedValue({ ok: true, claimed: false });

    const result = await handleStopChatWorkflow(makeRequest(), CHAT_ID);

    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ success: true, stopped: true });
  });

  it("returns 500 when the release CAS hits a DB error", async () => {
    mockValidated("wrun_abc");
    vi.mocked(compareAndSetChatActiveStreamId).mockResolvedValue({ ok: false, error: "db down" });

    const result = await handleStopChatWorkflow(makeRequest(), CHAT_ID);

    expect(result.status).toBe(500);
  });
});
