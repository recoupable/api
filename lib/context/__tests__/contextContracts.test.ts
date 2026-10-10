import { afterEach, describe, expect, it, vi } from "vitest";
import { contextCoverageSchema } from "../schema";
import { createContextReuseKey } from "../createContextReuseKey";
import { selectContextDocuments } from "../selectContextDocuments";
import { CONTEXT_CONTRACT_VERSION } from "../contracts/contextContractVersion";
import { contextContractEnvelopeSchema } from "../contracts/contextContractEnvelopeSchema";
import { classifyContextInputUrl } from "../contracts/classifyContextInputUrl";
import { resolveContextCorrectionAuthority } from "../contracts/resolveContextCorrectionAuthority";
import { contextPilotConfigSchema } from "../contracts/contextPilotConfigSchema";
import { evaluateContextPilotActivation } from "../contracts/evaluateContextPilotActivation";
import { contextObservedDateSchema } from "../contracts/contextObservedDateSchema";
import {
  contextAcceptanceFixtures,
  syntheticSpotifyId,
  type ContextAcceptanceFixture,
} from "./fixtures/contextAcceptanceFixtures";

/** Run one decision-table fixture against the contract it names. */
function runFixture(fixture: ContextAcceptanceFixture) {
  switch (fixture.check) {
    case "contract":
      expect(contextContractEnvelopeSchema.safeParse(fixture.input).success).toBe(
        fixture.expected.valid,
      );
      return;
    case "classification":
      expect(classifyContextInputUrl(fixture.input.url)).toMatchObject(
        fixture.expected.routing === "unsupported"
          ? { routing: "unsupported", reason: fixture.expected.reason }
          : fixture.expected.routing === "ingest_release"
            ? { routing: "ingest_release", resource: { id: fixture.expected.id } }
            : {
                routing: "ingest",
                pilot: fixture.expected.pilot,
                resource: { provider: fixture.expected.provider, id: fixture.expected.id },
              },
      );
      return;
    case "authority":
      expect(resolveContextCorrectionAuthority(fixture.input)).toEqual(fixture.expected);
      return;
    case "pilot": {
      const parsed = contextPilotConfigSchema.safeParse(fixture.input);
      expect(parsed.success).toBe(fixture.expected.valid);
      if (fixture.expected.valid && parsed.success)
        expect(evaluateContextPilotActivation(parsed.data)).toEqual({
          paid_activation: fixture.expected.paid_activation,
          unresolved_fields: fixture.expected.unresolved_fields,
          unpaid_operations: "allowed",
        });
      return;
    }
    case "coverage":
      expect(contextCoverageSchema.safeParse(fixture.input).success).toBe(fixture.expected.valid);
      return;
    case "observed_date":
      expect(contextObservedDateSchema.safeParse(fixture.input).success).toBe(
        fixture.expected.valid,
      );
      return;
    case "reuse":
      expect(
        createContextReuseKey(fixture.input.a) === createContextReuseKey(fixture.input.b),
      ).toBe(fixture.expected.same);
      return;
    case "selection": {
      const result = selectContextDocuments(fixture.input.documents, fixture.input.request);
      expect(result.documents.map(doc => doc.id)).toEqual(fixture.expected.documentIds);
      expect(result.missingTopics).toEqual(fixture.expected.missingTopics);
      if (fixture.id === "selection-source-injection-is-data") {
        expect(result.documents[0].evidenceKind).toBe("customer_assertion");
        expect(result.documents[0].text).toBe(fixture.input.documents[0].text);
      }
      return;
    }
  }
}

describe("context acceptance fixtures", () => {
  it("has unique fixture IDs covering every named scenario family", () => {
    const ids = contextAcceptanceFixtures.map(fixture => fixture.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const family of [
      "same-name",
      "collaboration",
      "reissue",
      "wrong-audio",
      "partial-audio",
      "lyrics-unavailable",
      "lyrics-full",
      "lyrics-multilingual",
      "throwback",
      "source-injection",
      "private-evidence",
      "two-songs-one-artist",
    ])
      expect(ids.some(id => id.includes(family))).toBe(true);
  });
  it("never embeds a real-looking ISRC", () => {
    expect(JSON.stringify(contextAcceptanceFixtures)).not.toMatch(/[A-Z]{2}[A-Z0-9]{3}\d{7}/);
  });
  it.each(contextAcceptanceFixtures.map(fixture => [fixture.id, fixture] as const))(
    "%s",
    (_id, fixture) => runFixture(fixture),
  );
});

describe("versioned URL-only contract", () => {
  it("exposes one contract version and keeps the ingest fields", () => {
    expect(CONTEXT_CONTRACT_VERSION).toBe("context-contract-v1");
    const parsed = contextContractEnvelopeSchema.parse({
      contract_version: CONTEXT_CONTRACT_VERSION,
      scope: "single_track",
      url: `https://open.spotify.com/track/${syntheticSpotifyId("TrackA")}?si=x`,
      idempotency_key: "key-1",
      topics: ["lyrics"],
    });
    expect(parsed).toMatchObject({ scope: "single_track", topics: ["lyrics"] });
    expect("assets" in parsed).toBe(false);
  });
  it("names the scope mismatch on the scope field", () => {
    const result = contextContractEnvelopeSchema.safeParse({
      contract_version: CONTEXT_CONTRACT_VERSION,
      scope: "single_track",
      url: "https://youtu.be/AbCdEfGhI_1",
      idempotency_key: "key-1",
    });
    expect(result.success).toBe(false);
    expect(result.success ? [] : result.error.issues.map(issue => issue.path.join("."))).toContain(
      "scope",
    );
  });
});

describe("input URL classification", () => {
  afterEach(() => vi.restoreAllMocks());
  it("never fetches while classifying", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    classifyContextInputUrl(`https://open.spotify.com/album/${syntheticSpotifyId("AlbumA")}`);
    classifyContextInputUrl("https://open.spotify.com/playlist/37i9dQfixture");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
  it("routes an album to the existing ingest_release action with a normalized URL", () => {
    const id = syntheticSpotifyId("AlbumA");
    expect(classifyContextInputUrl(`https://open.spotify.com/album/${id}?si=share`)).toEqual({
      routing: "ingest_release",
      resource: {
        provider: "spotify",
        kind: "album",
        id,
        url: `https://open.spotify.com/album/${id}`,
      },
    });
  });
  it("explains every unsupported reason", () => {
    for (const url of [
      "https://open.spotify.com/playlist/37i9dQfixture",
      "https://open.spotify.com/intl-fr/artist/" + syntheticSpotifyId("ArtistA"),
      "https://www.youtube.com/watch?list=PLfixture",
      "https://www.youtube.com/channel/UCfixture",
      "https://www.youtube.com/c/fixture",
      "https://user:pw@open.spotify.com/track/" + syntheticSpotifyId("TrackA"),
      "https://open.spotify.com/show/fixture",
    ]) {
      const result = classifyContextInputUrl(url);
      expect(result.routing).toBe("unsupported");
      if (result.routing === "unsupported") expect(result.message.length).toBeGreaterThan(10);
    }
  });
});

describe("pilot configuration", () => {
  it("blocks paid activation while unresolved, and never blocks unpaid checks", () => {
    const config = contextPilotConfigSchema.parse({
      spend_ceiling_credits: "unresolved",
      paid_but_unusable_output: "record_cost_retry_once",
      retention_withdrawal: "unresolved",
      freshness: { max_age_days: 7 },
      readiness_behavior: "block_all_paid",
    });
    expect(evaluateContextPilotActivation(config)).toEqual({
      paid_activation: "blocked",
      unresolved_fields: ["spend_ceiling_credits", "retention_withdrawal"],
      unpaid_operations: "allowed",
    });
    expect(
      classifyContextInputUrl("https://open.spotify.com/track/" + syntheticSpotifyId("T")),
    ).toMatchObject({
      routing: "ingest",
    });
    expect(
      contextCoverageSchema.safeParse({
        extent: "unknown",
        identity: "unknown",
        durationSeconds: null,
        startSeconds: null,
        endSeconds: null,
        language: null,
      }).success,
    ).toBe(true);
  });
  it("rejects a configuration that is not an object", () => {
    expect(() => evaluateContextPilotActivation("unresolved" as never)).toThrow();
  });
});

describe("correction authority", () => {
  it("rejects unknown actors, fields and kinds", () => {
    expect(() =>
      resolveContextCorrectionAuthority({
        actor: "owner",
        field: "isrc",
        current_evidence_kind: "observation",
        proposed_evidence_kind: "customer_assertion",
      }),
    ).toThrow();
    expect(() =>
      resolveContextCorrectionAuthority({
        actor: "customer",
        field: "rights_share",
        current_evidence_kind: "observation",
        proposed_evidence_kind: "customer_assertion",
      }),
    ).toThrow();
  });
  it("denies every ordinary-customer change to a shared identifier", () => {
    for (const field of ["spotify_track_id", "isrc", "credited_artist_order"])
      expect(
        resolveContextCorrectionAuthority({
          actor: "customer",
          field,
          current_evidence_kind: "observation",
          proposed_evidence_kind: "customer_assertion",
        }).decision,
      ).toBe("denied");
  });
});
