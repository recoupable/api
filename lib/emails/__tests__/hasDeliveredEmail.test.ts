import { describe, it, expect, vi, beforeEach } from "vitest";

import { hasDeliveredEmail } from "../hasDeliveredEmail";

const mockCount = vi.fn();
vi.mock("@/lib/supabase/email_send_log/countDeliveredEmails", () => ({
  countDeliveredEmails: (...args: unknown[]) => mockCount(...args),
}));

describe("hasDeliveredEmail", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns true when at least one email was delivered", async () => {
    mockCount.mockResolvedValue(2);
    expect(await hasDeliveredEmail("chat-1")).toBe(true);
    expect(mockCount).toHaveBeenCalledWith("chat-1");
  });

  it("returns false when none were delivered", async () => {
    mockCount.mockResolvedValue(0);
    expect(await hasDeliveredEmail("chat-1")).toBe(false);
  });
});
