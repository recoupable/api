import { afterEach, describe, expect, it, vi } from "vitest";
import { contextCoverageSchema } from "../schema";
import { createContextReuseKey } from "../createContextReuseKey";
import { selectContextDocuments } from "../selectContextDocuments";
import { CONTEXT_CONTRACT_VERSION } from "../contracts/contextContractVersion";
import { contextContractEnvelopeSchema } from "../contracts/contextContractEnvelopeSchema";
import { parseContextUrl } from "../parseContextUrl";
import { parseContextReleaseUrl } from "../parseContextReleaseUrl";
import { resolveContextCorrectionAuthority } from "../contracts/resolveContextCorrectionAuthority";
import { contextPilotConfigSchema } from "../contracts/contextPilotConfigSchema";
import { evaluateContextPilotActivation } from "../contracts/evaluateContextPilotActivation";
import { contextObservedDateSchema } from "../contracts/contextObservedDateSchema";
import {
  contextAcceptanceFixtures,
  syntheticSpotifyId,
  type ContextAcceptanceFixture,
} from "./fixtures/contextAcceptanceFixtures";

/**
 * Run a locator parser and report its result, or null when it rejects the input.
 *
 * @param parse - The parser call.
 * @returns The parsed value, or null when the parser throws.
 */
function attempt<T>(parse: () => T): T | null {
  try {
    return parse();
  } catch {
    return null;
  }
}

/** Run one decision-table fixture against the contract it names. */
function runFixture(fixture: ContextAcceptanceFixture) {
  switch (fixture.check) {
    case "contract":
      expect(contextContractEnvelopeSchema.safeParse(fixture.input).success).toBe(
        fixture.expected.valid,
      );
      return;
    case "routing": {
      const resource = attempt(() => parseContextUrl(fixture.input.url));
      const release = attempt(() => parseContextReleaseUrl(fixture.input.url));
      expect(
        resource ? { provider: resource.provider, kind: resource.kind, id: resource.id } : null,
      ).toEqual(fixture.expected.resource);
      expect(release?.id ?? null).toBe(fixture.expected.release_id);
      return;
    }
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

describe("input URL routing boundary", () => {
  afterEach(() => vi.restoreAllMocks());
  it("parses locators without any network call", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    for (const url of contextAcceptanceFixtures.flatMap(fixture =>
      fixture.check === "routing" ? [fixture.input.url] : [],
    )) {
      attempt(() => parseContextUrl(url));
      attempt(() => parseContextReleaseUrl(url));
    }
    expect(fetchSpy).not.toHaveBeenCalled();
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
      parseContextUrl("https://open.spotify.com/track/" + syntheticSpotifyId("T")),
    ).toMatchObject({ provider: "spotify", kind: "track" });
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
  it("never records relabelled derived output as a shared source observation", () => {
    for (const current of ["estimate", "interpretation", "customer_assertion", "creative_proposal"])
      for (const field of ["spotify_track_id", "isrc", "credited_artist_order", "release_date"])
        expect(
          resolveContextCorrectionAuthority({
            actor: "service",
            field,
            current_evidence_kind: current,
            proposed_evidence_kind: "observation",
            source_version_id: "source-version-fixture-2",
          }).recorded_as,
        ).toBeNull();
  });
  it("rejects an empty source version reference", () => {
    expect(() =>
      resolveContextCorrectionAuthority({
        actor: "service",
        field: "isrc",
        current_evidence_kind: "observation",
        proposed_evidence_kind: "observation",
        source_version_id: "",
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
