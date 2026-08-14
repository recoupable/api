import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isRecordInList } from "@/lib/attio/isRecordInList";

const LIST_ID = "f5abf9c0-b0a0-4d47-a6b1-37072e415e65";

describe("isRecordInList", () => {
  beforeEach(() => vi.stubEnv("ATTIO_API_KEY", "test-key"));
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("returns true when the record has an entry in the list", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ list_id: LIST_ID }] }))),
    );
    expect(await isRecordInList("people", "rec_1", LIST_ID)).toBe(true);
  });

  it("returns false when the record has no entry in the list", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ list_id: "other" }] }))),
    );
    expect(await isRecordInList("people", "rec_1", LIST_ID)).toBe(false);
  });

  it("returns false on a read failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("err", { status: 500 })));
    expect(await isRecordInList("people", "rec_1", LIST_ID)).toBe(false);
  });
});
