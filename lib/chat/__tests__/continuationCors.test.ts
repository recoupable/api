import { expect, it, vi } from "vitest";
import { OPTIONS as start } from "@/app/api/chat/route";
import { OPTIONS as resume } from "@/app/api/chat/[chatId]/stream/route";
import { OPTIONS as headless } from "@/app/api/chat/runs/route";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
it("allows the exact capability header on every chat stream preflight", async () => {
  for (const options of [start, resume, headless]) {
    const response = await options();
    expect(response.headers.get("Access-Control-Allow-Headers")?.split(", ")).toContain(
      "X-Recoup-Stream-Continuation",
    );
    expect(response.headers.get("Access-Control-Expose-Headers")).toBe(
      "x-workflow-run-id, x-workflow-stream-tail-index",
    );
  }
  expect(getCorsHeaders()["Access-Control-Allow-Headers"]).toBe(
    "Content-Type, Authorization, X-Requested-With, x-api-key",
  );
});

vi.mock("@/lib/chat/handleChatWorkflowStream", () => ({ handleChatWorkflowStream: vi.fn() }));
vi.mock("@/lib/chat/handleResumeChatStream", () => ({ handleResumeChatStream: vi.fn() }));
vi.mock("@/lib/chat/runs/handleStartChatRun", () => ({ handleStartChatRun: vi.fn() }));
