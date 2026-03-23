import { describe, it, expect, vi, beforeEach } from "vitest";
import { slackGet } from "../slackGet";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("slackGet", () => {
  it("throws on non-ok HTTP response", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    await expect(slackGet("auth.test", "token")).rejects.toThrow(
      "Slack API auth.test returned HTTP 500",
    );
  });

  it("throws on timeout", async () => {
    mockFetch.mockRejectedValue(new DOMException("The operation was aborted.", "AbortError"));

    await expect(slackGet("auth.test", "token")).rejects.toThrow();
  });

  it("returns parsed JSON on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ok: true, user_id: "U123" }),
    });

    const result = await slackGet("auth.test", "token");
    expect(result).toEqual({ ok: true, user_id: "U123" });
  });
});
