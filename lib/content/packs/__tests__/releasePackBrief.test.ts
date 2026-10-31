import { describe, expect, it } from "vitest";
import { releasePackBriefSchema } from "../releasePackSchema";
import { getPackBriefReadiness } from "../getPackBriefReadiness";
import { getPackBriefFingerprint } from "../getPackBriefFingerprint";

const supplied = {
  artist_name: "New Artist",
  song_title: "First Song",
  audio_url: "https://media.example/song.wav",
  occasion: "rediscovery",
  creative_direction: "Warm grainy artwork, quiet movement, no faces.",
};

describe("release pack inline brief", () => {
  it("accepts supplied music without an artist account or public catalog", () => {
    const brief = releasePackBriefSchema.parse(supplied);
    expect(getPackBriefReadiness(brief).missing).toEqual([]);
    expect(brief.artist_account_id).toBeUndefined();
  });

  it("asks only for gaps rather than repeating known identity", () => {
    const result = getPackBriefReadiness(
      releasePackBriefSchema.parse({
        artist_name: supplied.artist_name,
        song_title: supplied.song_title,
      }),
    );
    expect(result.missing).toEqual(["audio_url", "occasion", "creative_direction"]);
    expect(result.next_action).toContain("audio");
    expect(result.next_action).not.toContain("Who is the artist");
  });

  it("allows explicitly proposed creative defaults without inventing brand facts", () => {
    const brief = releasePackBriefSchema.parse({
      ...supplied,
      creative_direction: undefined,
      allow_creative_defaults: true,
    });
    const result = getPackBriefReadiness(brief);
    expect(result.missing).toEqual([]);
    expect(result.assumptions).toContain(
      "Propose a creative direction from the supplied music and artwork; this is not established artist branding.",
    );
  });

  it("artwork references can supply a direction without a face guide", () => {
    const brief = releasePackBriefSchema.parse({
      ...supplied,
      creative_direction: undefined,
      reference_image_urls: ["https://media.example/artwork.jpg"],
    });
    expect(getPackBriefReadiness(brief).missing).toEqual([]);
  });

  it("keeps original release and anniversary campaign dates distinct", () => {
    const brief = releasePackBriefSchema.parse({
      ...supplied,
      occasion: "anniversary",
      original_release_date: "2016-10-20",
      campaign_date: "2026-10-20",
    });
    expect(getPackBriefReadiness(brief).missing).toEqual([]);
    expect(brief.original_release_date).toBe("2016-10-20");
    expect(brief.campaign_date).toBe("2026-10-20");
  });

  it("does not invent an anniversary date", () => {
    const result = getPackBriefReadiness(
      releasePackBriefSchema.parse({ ...supplied, occasion: "anniversary" }),
    );
    expect(result.missing).toContain("original_release_date");
  });

  it("rejects caller account impersonation and invalid dates", () => {
    expect(
      releasePackBriefSchema.safeParse({ ...supplied, account_id: crypto.randomUUID() }).success,
    ).toBe(false);
    expect(
      releasePackBriefSchema.safeParse({ ...supplied, campaign_date: "2026-02-30" }).success,
    ).toBe(false);
  });

  it("refuses local URLs before any media service is invoked", () => {
    for (const url of [
      "http://127.0.0.1/song.mp3",
      "https://localhost/a",
      "file:///secret",
      "https://169.254.169.254/a",
    ]) {
      expect(releasePackBriefSchema.safeParse({ ...supplied, audio_url: url }).success, url).toBe(
        false,
      );
    }
  });

  it("binds approvals to the exact normalized music and campaign input", () => {
    const original = releasePackBriefSchema.parse(supplied);
    expect(getPackBriefFingerprint(original)).toBe(
      getPackBriefFingerprint(
        releasePackBriefSchema.parse({
          ...supplied,
          platforms: ["instagram", "tiktok"],
          primary_action: "listen",
        }),
      ),
    );
    expect(getPackBriefFingerprint(original)).not.toBe(
      getPackBriefFingerprint({
        ...original,
        audio_url: "https://media.example/remix.wav",
      }),
    );
    expect(getPackBriefFingerprint(original)).not.toBe(
      getPackBriefFingerprint({
        ...original,
        occasion: "remix",
      }),
    );
  });
});
