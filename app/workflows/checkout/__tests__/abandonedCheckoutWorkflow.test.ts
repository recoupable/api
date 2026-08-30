import { describe, it, expect, vi, beforeEach } from "vitest";
import { ABANDONED_CHECKOUT_EMAIL_DELAY_MS } from "@/lib/const";

const { sleepMock, sendMock } = vi.hoisted(() => ({ sleepMock: vi.fn(), sendMock: vi.fn() }));
vi.mock("workflow", () => ({ sleep: sleepMock }));
vi.mock("@/lib/emails/lifecycle/sendAbandonedCheckoutEmail", () => ({
  sendAbandonedCheckoutEmail: sendMock,
}));

const { abandonedCheckoutWorkflow } = await import("../abandonedCheckoutWorkflow");

describe("abandonedCheckoutWorkflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sleepMock.mockResolvedValue(undefined);
    sendMock.mockResolvedValue({ sent: true });
  });

  it("waits the abandonment delay, then runs the send step once", async () => {
    const args = { sessionId: "cs_1", email: "fan@example.com", plan: "pro" as const };
    const result = await abandonedCheckoutWorkflow(args);

    expect(sleepMock).toHaveBeenCalledWith(ABANDONED_CHECKOUT_EMAIL_DELAY_MS);
    expect(sleepMock.mock.invocationCallOrder[0]).toBeLessThan(
      sendMock.mock.invocationCallOrder[0],
    );
    expect(sendMock).toHaveBeenCalledWith(args);
    expect(result).toEqual({ sent: true });
  });
});
