import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createNote } from "@/lib/attio/createNote";

const note = {
  parentObject: "people",
  parentRecordId: "rec_1",
  title: "Catalog valuation — Mac Miller",
  content: "Valued **$54.6M**",
};

describe("createNote", () => {
  beforeEach(() => vi.stubEnv("ATTIO_API_KEY", "test-key"));
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("POSTs a markdown note to the record", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await createNote(note);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://api.attio.com/v2/notes");
    expect(init.method).toBe("POST");
    const data = JSON.parse(init.body).data;
    expect(data.parent_object).toBe("people");
    expect(data.parent_record_id).toBe("rec_1");
    expect(data.format).toBe("markdown");
    expect(data.title).toContain("Mac Miller");
    expect(data.content).toContain("$54.6M");
  });

  it("logs but does not throw on failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("bad", { status: 500 })));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(createNote(note)).resolves.toBeUndefined();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
