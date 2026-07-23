import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { upsertValuationLead } from "@/lib/valuation/upsertValuationLead";
import { assertPersonByEmail } from "@/lib/attio/assertPersonByEmail";
import { createNote } from "@/lib/attio/createNote";
import { isRecordInList } from "@/lib/attio/isRecordInList";
import { addRecordToList } from "@/lib/attio/addRecordToList";

vi.mock("@/lib/attio/assertPersonByEmail", () => ({ assertPersonByEmail: vi.fn() }));
vi.mock("@/lib/attio/createNote", () => ({ createNote: vi.fn() }));
vi.mock("@/lib/attio/isRecordInList", () => ({ isRecordInList: vi.fn() }));
vi.mock("@/lib/attio/addRecordToList", () => ({ addRecordToList: vi.fn() }));

const lead = {
  email: "artist@example.com",
  artistName: "Mac Miller",
  artistId: "4LLpKhyESsyAXpc4laK94U",
  valueBand: { low: 37_500_000, central: 54_600_000, high: 76_800_000 },
  lifetimeStreams: 22_000_000_000,
  followerCount: 13_000_000,
};

describe("upsertValuationLead", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("ATTIO_API_KEY", "test-key");
    vi.mocked(assertPersonByEmail).mockResolvedValue({ recordId: "rec_123" });
    vi.mocked(isRecordInList).mockResolvedValue(false);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("asserts the person with the qualifying attributes and returns the record link", async () => {
    const res = await upsertValuationLead(lead);
    expect(res).toEqual({
      success: true,
      recordUrl: "https://app.attio.com/recoup/person/rec_123/overview",
    });

    const values = vi.mocked(assertPersonByEmail).mock.calls[0][0];
    expect(values.email_addresses).toEqual([{ email_address: "artist@example.com" }]);
    expect(values.lead_source).toBe("Catalog Valuation");
    expect(values.est_catalog_value).toBe(54_600_000); // band central = lead score
    expect(values.looked_up_artist).toBe("Mac Miller");
    expect(values.spotify_artist_url).toBe(
      "https://open.spotify.com/artist/4LLpKhyESsyAXpc4laK94U",
    );
    expect(values.lifetime_streams).toBe(22_000_000_000);
    expect(values.follower_count).toBe(13_000_000);
    expect(values.valued_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("attaches a chronology note for the run", async () => {
    await upsertValuationLead(lead);
    const note = vi.mocked(createNote).mock.calls[0][0];
    expect(note.parentObject).toBe("people");
    expect(note.parentRecordId).toBe("rec_123");
    expect(note.title).toContain("Mac Miller");
    expect(note.content).toContain("Mac Miller");
    expect(note.content).toContain("$54,600,000");
  });

  it("adds the person to the pipeline at New when not already on it", async () => {
    await upsertValuationLead(lead);
    expect(isRecordInList).toHaveBeenCalledWith("people", "rec_123", expect.any(String));
    expect(addRecordToList).toHaveBeenCalledWith("valuation_leads", "people", "rec_123", {
      stage: ["New"],
    });
  });

  it("still notes a re-run but does NOT add a duplicate card", async () => {
    vi.mocked(isRecordInList).mockResolvedValue(true);
    await upsertValuationLead(lead);
    expect(createNote).toHaveBeenCalledTimes(1); // chronology still grows
    expect(addRecordToList).not.toHaveBeenCalled(); // no duplicate card
  });

  it("omits follower_count when it is not known", async () => {
    const { followerCount: _omit, ...noFollowers } = lead;
    await upsertValuationLead(noFollowers);
    const values = vi.mocked(assertPersonByEmail).mock.calls[0][0];
    expect(values).not.toHaveProperty("follower_count");
  });

  it("returns an error without touching Attio when the key is missing", async () => {
    vi.unstubAllEnvs();
    const res = await upsertValuationLead(lead);
    expect(res.success).toBe(false);
    expect(res.error).toContain("ATTIO_API_KEY");
    expect(assertPersonByEmail).not.toHaveBeenCalled();
  });

  it("fails fast (no note, no list work) when the person assert errors", async () => {
    vi.mocked(assertPersonByEmail).mockResolvedValue({ error: "Attio person assert failed: 400" });
    const res = await upsertValuationLead(lead);
    expect(res.success).toBe(false);
    expect(res.error).toContain("400");
    expect(createNote).not.toHaveBeenCalled();
    expect(addRecordToList).not.toHaveBeenCalled();
  });
});
