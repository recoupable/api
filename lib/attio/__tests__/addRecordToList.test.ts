import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { addRecordToList } from "@/lib/attio/addRecordToList";

describe("addRecordToList", () => {
  beforeEach(() => vi.stubEnv("ATTIO_API_KEY", "test-key"));
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("POSTs a list entry with the given entry values", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await addRecordToList("valuation_leads", "people", "rec_1", { stage: ["New"] });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://api.attio.com/v2/lists/valuation_leads/entries");
    expect(init.method).toBe("POST");
    const data = JSON.parse(init.body).data;
    expect(data.parent_object).toBe("people");
    expect(data.parent_record_id).toBe("rec_1");
    expect(data.entry_values).toEqual({ stage: ["New"] });
  });

  it("logs but does not throw on failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("bad", { status: 422 })));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      addRecordToList("valuation_leads", "people", "rec_1", { stage: ["New"] }),
    ).resolves.toBeUndefined();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
