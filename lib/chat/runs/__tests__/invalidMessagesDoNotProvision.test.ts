import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { handleStartChatRun } from "../handleStartChatRun";
import { provisionRunSession } from "../provisionRunSession";
import { mintEphemeralAccountKey } from "@/lib/keys/mintEphemeralAccountKey";
import { start } from "workflow/api";

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(async () => ({ accountId: "fixture-account", orgId: null })),
}));
vi.mock("../provisionRunSession", () => ({ provisionRunSession: vi.fn() }));
vi.mock("@/lib/keys/mintEphemeralAccountKey", () => ({ mintEphemeralAccountKey: vi.fn() }));
vi.mock("@/lib/supabase/account_api_keys/deleteApiKey", () => ({ deleteApiKey: vi.fn() }));
vi.mock("@/lib/chat/buildRunAgentInput", () => ({ buildRunAgentInput: vi.fn() }));
vi.mock("@/app/lib/workflows/runAgentWorkflow", () => ({ runAgentWorkflow: vi.fn() }));
vi.mock("workflow/api", () => ({ start: vi.fn() }));
vi.mock("@/lib/chat/compareAndSetChatActiveStreamId", () => ({
  compareAndSetChatActiveStreamId: vi.fn(),
}));
vi.mock("../linkTriggerRunToWorkflow", () => ({ linkTriggerRunToWorkflow: vi.fn() }));

describe("headless request side-effect boundary", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for the legacy documented shape without provisioning, minting or starting", async () => {
    const response = await handleStartChatRun(
      new NextRequest("https://x.test/api/chat/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ id: "m1", role: "user", content: "hi" }] }),
      }),
    );
    expect(response.status).toBe(400);
    expect(provisionRunSession).not.toHaveBeenCalled();
    expect(mintEphemeralAccountKey).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
  });
});
