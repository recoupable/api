import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { gateWorkflowCredits } from "@/app/lib/workflows/gateWorkflowCredits";
import { ensureCreditsOrShortCircuit } from "@/lib/credits/ensureCreditsOrShortCircuit";
import { alertCreditShortfall } from "@/lib/credits/alertCreditShortfall";

vi.mock("@/lib/credits/ensureCreditsOrShortCircuit", () => ({
  ensureCreditsOrShortCircuit: vi.fn(),
}));
vi.mock("@/lib/credits/alertCreditShortfall", () => ({
  alertCreditShortfall: vi.fn(),
}));

const base = { accountId: "acc-1", chatId: "chat-1", sessionId: "sess-1" };

describe("gateWorkflowCredits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns hasCredits:true and does NOT alert when credits are available", async () => {
    vi.mocked(ensureCreditsOrShortCircuit).mockResolvedValue(null);

    const result = await gateWorkflowCredits(base);

    expect(result).toEqual({ hasCredits: true });
    expect(alertCreditShortfall).not.toHaveBeenCalled();
  });

  it("gates on the account id with a 1-credit floor", async () => {
    vi.mocked(ensureCreditsOrShortCircuit).mockResolvedValue(null);

    await gateWorkflowCredits(base);

    expect(ensureCreditsOrShortCircuit).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: "acc-1", creditsToDeduct: 1 }),
    );
  });

  it("returns hasCredits:false and fires a Telegram alert on shortfall", async () => {
    vi.mocked(ensureCreditsOrShortCircuit).mockResolvedValue(
      NextResponse.json({ error: "insufficient" }, { status: 402 }),
    );

    const result = await gateWorkflowCredits(base);

    expect(result).toEqual({ hasCredits: false });
    expect(alertCreditShortfall).toHaveBeenCalledWith({
      accountId: "acc-1",
      chatId: "chat-1",
      sessionId: "sess-1",
    });
  });

  it("fails open (hasCredits:true, no alert) when the credit check throws", async () => {
    vi.mocked(ensureCreditsOrShortCircuit).mockRejectedValue(new Error("stripe down"));

    const result = await gateWorkflowCredits(base);

    expect(result).toEqual({ hasCredits: true });
    expect(alertCreditShortfall).not.toHaveBeenCalled();
  });
});
