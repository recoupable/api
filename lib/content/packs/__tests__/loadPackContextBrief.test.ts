import { beforeEach, describe, expect, it, vi } from "vitest";
import { callContextRpc } from "@/lib/supabase/context_requests/callContextRpc";
import { loadPackContextBrief } from "../loadPackContextBrief";
import { releasePackBriefSchema } from "../releasePackSchema";

vi.mock("@/lib/supabase/context_requests/callContextRpc", () => ({ callContextRpc: vi.fn() }));
const owner = "11111111-1111-4111-8111-111111111111";
const snapshotId = "22222222-2222-4222-8222-222222222222";
const subject = "33333333-3333-4333-8333-333333333333";
const documentId = "44444444-4444-4444-8444-444444444444";
const otherSubject = "55555555-5555-4555-8555-555555555555";
const document = {
  id: documentId,
  ownerId: owner,
  subjectId: subject,
  status: "accepted",
  topic: "song_summary",
  text: "Quiet piano with an uncertain second vocal.",
  version: 2,
  evidenceKind: "interpretation",
  coverage: "partial",
  sourceVersionIds: ["66666666-6666-4666-8666-666666666666"],
};
const brief = () => releasePackBriefSchema.parse({ context_brief_id: snapshotId });
const saved = (documents: unknown[]) => ({
  id: snapshotId,
  state: "saved",
  superseded: false,
  purpose: "creative_direction",
  brief: { documents },
});

describe("saved pack context attribution", () => {
  beforeEach(() => vi.clearAllMocks());

  it("preserves subject, document, coverage and interpretation when reusing saved evidence", async () => {
    vi.mocked(callContextRpc).mockResolvedValue(saved([document]));
    const result = await loadPackContextBrief({ accountId: owner }, brief());
    for (const value of [
      snapshotId,
      documentId,
      subject,
      "interpretation",
      "partial",
      document.text,
    ]) {
      expect(result.evidence[0].text).toContain(value);
      expect(result.song_summary).toContain(value);
    }
    expect(releasePackBriefSchema.safeParse(result).success).toBe(true);
  });

  it("keeps multiple recordings attributed without blending them into one song summary or direction", async () => {
    const docs = [
      document,
      { ...document, id: otherSubject, subjectId: otherSubject, text: "Fast drums." },
    ];
    vi.mocked(callContextRpc).mockResolvedValue(
      saved([
        ...docs,
        ...docs.map((doc, index) => ({
          ...doc,
          id:
            index === 0
              ? "77777777-7777-4777-8777-777777777777"
              : "88888888-8888-4888-8888-888888888888",
          topic: "artwork_branding",
        })),
      ]),
    );
    const result = await loadPackContextBrief({ accountId: owner }, brief());
    expect(result.song_summary).toBeUndefined();
    expect(result.creative_direction).toBeUndefined();
    expect(result.evidence).toHaveLength(4);
    expect(result.evidence[0].text).toContain(subject);
    expect(result.evidence[1].text).toContain(otherSubject);
  });

  it("retains a retrieval pointer instead of cutting a long claim before its qualifier", async () => {
    vi.mocked(callContextRpc).mockResolvedValue(
      saved([
        {
          ...document,
          topic: "artwork_branding",
          text: "Possible visual motif. ".repeat(110) + "This is not established artist branding.",
        },
      ]),
    );
    const result = await loadPackContextBrief({ accountId: owner }, brief());
    expect(result.creative_direction).toBeUndefined();
    expect(result.evidence[0].text).toContain(snapshotId);
    expect(result.evidence[0].text).toContain(documentId);
    expect(result.evidence[0].text).toContain("omitted");
    expect(result.evidence[0].text).not.toContain("Possible visual motif");
    expect(releasePackBriefSchema.safeParse(result).success).toBe(true);
  });

  it("keeps customer assertions distinct and does not duplicate evidence on same-pack edits", async () => {
    vi.mocked(callContextRpc).mockResolvedValue(
      saved([{ ...document, evidenceKind: "customer_assertion" }]),
    );
    const first = await loadPackContextBrief({ accountId: owner }, brief());
    expect(first.evidence[0].kind).toBe("customer_assertion");
    const edited = await loadPackContextBrief({ accountId: owner }, first);
    expect(edited).toEqual(first);
  });

  it("preserves current customer direction and evidence while excluding another workspace", async () => {
    vi.mocked(callContextRpc).mockResolvedValue(
      saved([
        { ...document, ownerId: otherSubject, text: "PRIVATE" },
        { ...document, topic: "artwork_branding" },
      ]),
    );
    const input = releasePackBriefSchema.parse({
      ...brief(),
      song_summary: "Customer summary",
      creative_direction: "Current campaign",
      evidence: [{ kind: "customer_assertion", text: "Keep our supplied artwork." }],
    });
    const result = await loadPackContextBrief(
      { accountId: otherSubject, organizationId: owner },
      input,
    );
    expect(result.song_summary).toBe(input.song_summary);
    expect(result.creative_direction).toBe(input.creative_direction);
    expect(result.evidence[0]).toEqual(input.evidence[0]);
    expect(JSON.stringify(result)).not.toContain("PRIVATE");
    expect(callContextRpc).toHaveBeenCalledWith("read_context_brief", {
      p_owner: owner,
      p_brief: snapshotId,
    });
  });

  it("keeps unavailable and superseded snapshots blocked and honors evidence capacity", async () => {
    vi.mocked(callContextRpc).mockResolvedValue({ ...saved([document]), superseded: true });
    await expect(loadPackContextBrief({ accountId: owner }, brief())).rejects.toThrow();
    vi.mocked(callContextRpc).mockResolvedValue({
      ...saved([]),
      state: "unavailable",
      brief: null,
    });
    await expect(loadPackContextBrief({ accountId: owner }, brief())).rejects.toThrow();
    vi.mocked(callContextRpc).mockResolvedValue(saved([document]));
    const input = releasePackBriefSchema.parse({
      ...brief(),
      evidence: Array.from({ length: 20 }, (_, i) => ({
        kind: "customer_assertion",
        text: `Customer ${i}`,
      })),
    });
    expect((await loadPackContextBrief({ accountId: owner }, input)).evidence).toEqual(
      input.evidence,
    );
  });
});
