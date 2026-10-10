import { describe, expect, it } from "vitest";
import { campaignBriefSchema } from "../campaignBriefSchema";

// Hex letters make the upper-case duplicate check below meaningful.
const requestId = "00000000-0000-4000-a000-0000000000aa";
const subjectId = "00000000-0000-4000-a000-0000000000bb";
const brief = { name: "Release campaign", goal: "Promote the single" };

function failure(input: unknown) {
  const parsed = campaignBriefSchema.safeParse(input);
  if (parsed.success) throw new Error(`Expected rejection: ${JSON.stringify(input)}`);
  return parsed.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join("\n");
}

describe("campaignBriefSchema", () => {
  it("accepts channels and already-saved promoted subjects, keeping the brief shape", () => {
    const parsed = campaignBriefSchema.parse({
      ...brief,
      audience: "Existing listeners",
      start_date: "2026-10-01",
      end_date: "2026-10-31",
      channels: ["  Short-form video ", "Radio", "X"],
      promoted: [{ request_id: requestId, subject_id: subjectId }],
    });
    expect(parsed.channels).toEqual(["Short-form video", "Radio", "X"]);
    expect(parsed.promoted).toEqual([{ request_id: requestId, subject_id: subjectId }]);
  });

  it("leaves a legacy brief without channels or promoted keys untouched", () => {
    const parsed = campaignBriefSchema.parse(brief);
    expect(Object.keys(parsed)).toEqual(["name", "goal"]);
    expect(campaignBriefSchema.safeParse({ ...brief, channels: [], promoted: [] }).success).toBe(
      true,
    );
  });

  it("rejects ambiguous links instead of guessing what is promoted", () => {
    expect(failure({ ...brief, promoted_url: "https://example.com/release" })).toMatch(
      /promoted_url/,
    );
    expect(failure({ ...brief, promoted: ["https://example.com/release"] })).toMatch(/promoted/);
    expect(failure({ ...brief, promoted: [{ url: "https://example.com/release" }] })).toMatch(
      /request_id|subject_id|url/,
    );
    expect(
      failure({
        ...brief,
        promoted: [{ request_id: requestId, subject_id: subjectId, url: "https://example.com" }],
      }),
    ).toMatch(/url/);
    expect(
      failure({ ...brief, promoted: [{ request_id: "spotify:album:1", subject_id: subjectId }] }),
    ).toMatch(/request_id/);
    expect(failure({ ...brief, channels: ["https://example.com/channel"] })).toMatch(
      /Channels are names/,
    );
    expect(failure({ ...brief, channels: ["www.example.com"] })).toMatch(/Channels are names/);
    expect(failure({ ...brief, channels: ["mailto:team@example.com"] })).toMatch(
      /Channels are names/,
    );
    expect(failure({ ...brief, channels: ["spotify:album:example"] })).toMatch(
      /Channels are names/,
    );
  });

  it("rejects private file references; material intake is a separate action", () => {
    expect(failure({ ...brief, file_path: "/private/artwork.png" })).toMatch(/file_path/);
    expect(failure({ ...brief, assets: ["artwork.png"] })).toMatch(/assets/);
    expect(failure({ ...brief, channels: ["/private/plan.pdf"] })).toMatch(/Channels are names/);
    expect(failure({ ...brief, channels: ["file:plan.pdf"] })).toMatch(/Channels are names/);
    expect(failure({ ...brief, channels: ["C:\\plans\\brief.pdf"] })).toMatch(/Channels are names/);
  });

  it("catches obvious links only, as documented; channel names are never fetched or linked", () => {
    const parsed = campaignBriefSchema.parse({
      ...brief,
      channels: ["example.com/release", "plan.pdf"],
    });
    expect(parsed.channels).toEqual(["example.com/release", "plan.pdf"]);
    expect(parsed.promoted).toBeUndefined();
  });

  it("requires distinct bounded channels and promoted pairs", () => {
    expect(failure({ ...brief, channels: ["TikTok", "tiktok "] })).toMatch(/distinct/);
    expect(
      failure({ ...brief, channels: Array.from({ length: 11 }, (_, i) => `channel ${i}`) }),
    ).toMatch(/channels/);
    expect(failure({ ...brief, channels: ["   "] })).toMatch(/channels/);
    // The database collapses inner whitespace before comparing, so the boundary must agree.
    expect(failure({ ...brief, channels: ["Short  form video", "short form video"] })).toMatch(
      /distinct/,
    );
    expect(failure({ ...brief, channels: ["Radio\tpress"] })).toMatch(/control characters/);
    expect(
      failure({
        ...brief,
        promoted: [
          { request_id: requestId, subject_id: subjectId },
          { request_id: requestId.toUpperCase(), subject_id: subjectId },
        ],
      }),
    ).toMatch(/distinct/);
    expect(
      failure({
        ...brief,
        promoted: Array.from({ length: 21 }, (_, i) => ({
          request_id: requestId,
          subject_id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
        })),
      }),
    ).toMatch(/promoted/);
  });

  it("keeps the date ordering rule", () => {
    expect(failure({ ...brief, start_date: "2026-10-31", end_date: "2026-10-01" })).toMatch(
      /end date/,
    );
  });
});
