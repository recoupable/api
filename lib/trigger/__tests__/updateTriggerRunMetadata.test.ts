import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { updateTriggerRunMetadata } from "@/lib/trigger/updateTriggerRunMetadata";

describe("updateTriggerRunMetadata", () => {
  const originalKey = process.env.TRIGGER_SECRET_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TRIGGER_SECRET_KEY = "tr_test_key";
  });

  afterEach(() => {
    process.env.TRIGGER_SECRET_KEY = originalKey;
  });

  it("PUTs the metadata to the Trigger.dev run with the secret key", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true }) as unknown as typeof fetch;

    const ok = await updateTriggerRunMetadata("run_abc", {
      sessionId: "sess-1",
      chatId: "chat-1",
      workflowRunId: "wrun_abc",
    });

    expect(ok).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      "https://api.trigger.dev/api/v1/runs/run_abc/metadata",
      expect.objectContaining({
        method: "PUT",
        headers: expect.objectContaining({
          Authorization: "Bearer tr_test_key",
          "Content-Type": "application/json",
        }),
      }),
    );
    const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({
      metadata: { sessionId: "sess-1", chatId: "chat-1", workflowRunId: "wrun_abc" },
    });
  });

  it("returns false (never throws) on a non-2xx response", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 }) as unknown as typeof fetch;
    await expect(updateTriggerRunMetadata("run_missing", { chatId: "c" })).resolves.toBe(false);
  });

  it("returns false (never throws) when the request itself fails", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network")) as unknown as typeof fetch;
    await expect(updateTriggerRunMetadata("run_abc", { chatId: "c" })).resolves.toBe(false);
  });

  it("returns false without calling fetch when TRIGGER_SECRET_KEY is unset", async () => {
    delete process.env.TRIGGER_SECRET_KEY;
    global.fetch = vi.fn() as unknown as typeof fetch;
    await expect(updateTriggerRunMetadata("run_abc", { chatId: "c" })).resolves.toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("updateTriggerRunMetadata timeout", () => {
  it("bounds the request with an abort signal so a hung Trigger.dev cannot stall the 202", async () => {
    process.env.TRIGGER_SECRET_KEY = "tr_test_key";
    global.fetch = vi.fn().mockResolvedValue({ ok: true }) as unknown as typeof fetch;
    await updateTriggerRunMetadata("run_abc", { chatId: "c" });
    const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});
