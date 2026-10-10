import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { contextOperationSchema, processContextOperation } from "../processContextOperation";
import type { ReleaseCaseProjection, ReleaseCaseReview } from "../releaseCaseTypes";
import type { ReleaseFormatObservation } from "../releaseFormatTypes";
// Isolate module initialization from hosted Supabase credentials; tests inject authorization.
vi.mock("../authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));
const actor = "11111111-1111-4111-8111-111111111111";
const owner = "22222222-2222-4222-8222-222222222222";
const request = "33333333-3333-4333-8333-333333333333";
const subject = "55555555-5555-4555-8555-555555555555";
const releaseId = "A".repeat(22);
const observedFormat: ReleaseFormatObservation = {
  source: "spotify_album_observation",
  state: "observed",
  observed_type: "album",
  format_state: "album",
  reported_total_tracks: 3,
  release_date: "2024-05-17",
  release_date_precision: "day",
  label: "Fixture label",
  upc: null,
  upc_state: "not_observed",
  disc_count: 2,
  multi_disc: true,
  reissue: "unknown",
  physical_format: "unknown",
};
const projection: ReleaseCaseProjection = {
  contract_version: "release-case-v1",
  operation: "release_metadata_reconciliation",
  request_id: request,
  subject_id: subject,
  title: "Fixture double album",
  release_url: `https://open.spotify.com/album/${releaseId}`,
  release_format: observedFormat,
  readiness: "partial",
  tracks: [],
  track_page: { state: "ready", releaseId, slots: [], nextCursor: null, hasMore: false },
  identity_observations: { state: "not_collected", candidates: [] },
  evidence_manifest: [],
  gaps: ["Reissue and physical-format status are not observable from Spotify metadata."],
  reviewable: false,
  capabilities: {
    distribute: "unsupported",
    register_rights: "unsupported",
    collect_royalties: "unsupported",
  },
  cost: { provider_calls: 0, model_calls: 0, infrastructure_cost: "unmeasured" },
  fingerprint: "a".repeat(64),
  latest_review: null,
};
describe("release format observation", () => {
  it("returns the database projection untouched without provider calls", async () => {
    const rpc = vi.fn(async () => projection);
    const dispatch = vi.fn();
    const authorize = vi.fn(async () => ({
      accountId: actor,
      ownerId: owner,
      organizationId: owner,
    }));
    const result = (await processContextOperation(
      actor,
      { action: "read_release_case", organization_id: owner, request_id: request },
      { rpc, dispatch, authorize },
    )) as ReleaseCaseProjection;
    // Same object reference: the API neither reinterprets nor fills in format fields.
    expect(result).toBe(projection);
    expect(result.release_format).toEqual(observedFormat);
    expect(result.release_format.upc).toBeNull();
    expect(rpc).toHaveBeenCalledExactlyOnceWith("read_context_release_case", {
      p_actor: actor,
      p_owner: owner,
      p_request: request,
    });
    expect(dispatch).not.toHaveBeenCalled();
  });
  it("keeps uncollected, not-observed and unknown as distinct states", () => {
    const uncollected: ReleaseFormatObservation = {
      ...observedFormat,
      state: "uncollected",
      observed_type: null,
      format_state: "unknown",
      reported_total_tracks: null,
      release_date: null,
      release_date_precision: null,
      label: null,
      upc_state: "uncollected",
      disc_count: null,
      multi_disc: null,
    };
    expect(uncollected.upc_state).not.toBe(observedFormat.upc_state);
    expect(uncollected.format_state).not.toBe(observedFormat.format_state);
    // Spotify metadata cannot establish these; the contract forbids any other value.
    expectTypeOf<ReleaseFormatObservation["reissue"]>().toEqualTypeOf<"unknown">();
    expectTypeOf<ReleaseFormatObservation["physical_format"]>().toEqualTypeOf<"unknown">();
    expectTypeOf<ReleaseFormatObservation["format_state"]>().toEqualTypeOf<
      "single" | "album" | "compilation" | "unknown"
    >();
  });
  it("types saved review snapshots from before the format projection without release_format", () => {
    // Snapshots are immutable; reviews saved before the migration never contained the field.
    const { release_format: _omitted, latest_review: _latest, ...legacy } = projection;
    const snapshot: ReleaseCaseReview["snapshot"] = legacy;
    expect(snapshot).not.toHaveProperty("release_format");
    expectTypeOf<NonNullable<ReleaseCaseReview["snapshot"]>["release_format"]>().toEqualTypeOf<
      ReleaseFormatObservation | undefined
    >();
  });
  it("rejects client-supplied format fields on read_release_case", () => {
    for (const extra of [
      { release_format: observedFormat },
      { format_state: "album" },
      { upc: "0".repeat(12) },
    ]) {
      const parsed = contextOperationSchema.safeParse({
        action: "read_release_case",
        organization_id: owner,
        request_id: request,
        ...extra,
      });
      expect(parsed.success).toBe(false);
      expect(parsed.error?.issues[0]).toMatchObject({
        code: "unrecognized_keys",
        keys: [Object.keys(extra)[0]],
      });
    }
  });
});
