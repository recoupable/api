import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";
import { writeFileSync } from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { POST } from "@/app/api/context/route";
import { handleContextToolOperation } from "@/lib/mcp/tools/context/handleContextToolOperation";
import { contextOperationSchema } from "@/lib/context/processContextOperation";
import {
  contextResponseReferences,
  contextResponseSchemas,
  contextResponseStatusCodes,
} from "@/lib/context/contracts/contextOperationResponseCatalog";
import { contextOperationExampleInputs } from "../contextOperationExampleInputs";
import published from "../fixtures/context-contract.json";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  auth: vi.fn(),
  resolve: vi.fn(),
  access: vi.fn(),
  dispatch: vi.fn(),
  release: vi.fn(),
  tracks: vi.fn(),
}));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: mocks.auth }));
vi.mock("@/lib/mcp/resolveAccountId", () => ({ resolveAccountId: mocks.resolve }));
vi.mock("@/lib/organizations/validateOrganizationAccess", () => ({
  validateOrganizationAccess: mocks.access,
}));
vi.mock("@/lib/supabase/context_requests/callContextRpc", () => ({ callContextRpc: mocks.rpc }));
vi.mock("@/lib/context/dispatchContextRequest", () => ({ dispatchContextRequest: mocks.dispatch }));
vi.mock("@/lib/context/dispatchContextReleaseVerification", () => ({
  dispatchContextReleaseVerification: mocks.release,
}));
vi.mock("@/lib/context/dispatchContextReleaseTrackIsrcs", () => ({
  dispatchContextReleaseTrackIsrcs: mocks.tracks,
}));

const actor = "00000000-0000-4000-8000-000000000001";
const owner = "00000000-0000-4000-8000-000000000002";
const requestId = "00000000-0000-4000-8000-000000000003";
const subject = "00000000-0000-4000-8000-000000000004";
const record = "00000000-0000-4000-8000-000000000005";
const source = "00000000-0000-4000-8000-000000000006";
const version = "00000000-0000-4000-8000-000000000007";
const when = "2026-10-21T00:00:00Z";
const spotify = "4uLU6hMCjMI75M1A2tKUQC";
const trackUrl = `https://open.spotify.com/track/${spotify}`;
const page = {
  state: "ready",
  releaseId: spotify,
  sourceResultId: source,
  coverage: "partial",
  collectedSlots: 1,
  reportedTotal: 1,
  linkedSlots: 1,
  unavailableSlots: 0,
  slots: [
    {
      slotIndex: 0,
      spotifyTrackId: spotify,
      discNumber: 1,
      trackNumber: 1,
      sourceResultId: source,
    },
  ],
  nextCursor: null,
  hasMore: false,
};
const identity = {
  state: "ready",
  releaseSourceResultId: source,
  resultId: record,
  coverage: "partial",
  candidates: [
    {
      slotIndex: 0,
      spotifyTrackId: spotify,
      observationState: "observed",
      isrc: "AAA000000001",
      mappingState: "unmapped",
    },
  ],
};
const releaseCase = {
  contract_version: "release-case-v1",
  operation: "release_metadata_reconciliation",
  request_id: requestId,
  subject_id: subject,
  title: "Synthetic saved release",
  release_url: `https://open.spotify.com/album/${spotify}`,
  readiness: "partial",
  tracks: [
    {
      slot_index: 0,
      spotify_track_id: spotify,
      title: "Synthetic recording",
      disc_number: 1,
      track_number: 1,
      credited_artists: [],
    },
  ],
  track_page: page,
  identity_observations: identity,
  evidence_manifest: [
    {
      document_id: record,
      document_revision: 1,
      result_id: source,
      source_version_id: version,
      source_url: null,
      retrieved_at: when,
    },
  ],
  gaps: [
    "Only saved Spotify observations are supported; cross-source comparison is unavailable.",
    "Composition, songwriter, publisher, contracts and approved-master evidence are not yet linked.",
  ],
  reviewable: true,
  capabilities: {
    distribute: "unsupported",
    register_rights: "unsupported",
    collect_royalties: "unsupported",
  },
  cost: { provider_calls: 0, model_calls: 0, infrastructure_cost: "unmeasured" },
  fingerprint: "a".repeat(64),
  latest_review: null,
};
const { latest_review: _latest, ...caseSnapshot } = releaseCase;
const review = {
  id: record,
  created_at: when,
  actor_id: actor,
  decision: "reviewed",
  policy_version: "workspace-member-metadata-review-v1",
  state: "saved",
  stale: false,
  snapshot: caseSnapshot,
  note: "Metadata review only; no rights or distribution approval.",
};
function requestRecord(input: unknown = { url: trackUrl }, status = "completed") {
  return {
    id: requestId,
    owner_id: owner,
    created_by: actor,
    resource_id: record,
    idempotency_key: "synthetic-example",
    input_fingerprint: "a".repeat(64),
    input,
    status,
    workflow_id: null,
    revision: 0,
    created_at: when,
    updated_at: when,
    lease_expires_at: null,
    output: status === "queued" ? null : { subjectIds: [subject] },
    error: null,
  };
}
const savedDocument = {
  id: record,
  ownerId: owner,
  subjectId: subject,
  resultId: source,
  topic: "recording_metadata",
  version: 1,
  status: "accepted",
  evidenceKind: "observation",
  text: JSON.stringify({ title: "Synthetic recording" }),
  sourceVersionIds: [version],
  coverage: "partial",
  sources: [{ versionId: version, url: trackUrl, retrievedAt: when }],
};
let activeAction = "";
function storage(name: string, params: Record<string, unknown>): unknown {
  expect(params.p_owner).toBe(owner);
  if (name === "read_context_request") return requestRecord();
  if (name === "create_context_request")
    return {
      ...requestRecord(params.p_input, "queued"),
      idempotency_key: params.p_key,
      input_fingerprint: params.p_fingerprint,
    };
  const kinds: Record<string, unknown> = {
    create_catalog_context_request: { kind: "catalog", catalogId: record },
    create_context_artist_request: { kind: "artist", artistId: record },
    create_context_songwriter_name_request: {
      kind: "songwriter",
      name: "Example songwriter",
      identityConfirmed: false,
    },
    create_context_company_name_request: {
      kind: "company",
      name: "Example company",
      identityConfirmed: false,
    },
    create_context_campaign_brief_request: {
      kind: "campaign",
      brief: { name: "Example release campaign", goal: "Review saved release evidence" },
      identityConfirmed: false,
    },
    create_context_supporting_text_request: {
      kind: "material",
      materialType: "text",
      title: "Submitted example note",
      contentHash: "a".repeat(64),
    },
    create_context_release_request: {
      kind: "release",
      url: `https://open.spotify.com/album/${spotify}`,
      releaseId: spotify,
    },
  };
  if (name in kinds)
    return { ...requestRecord(kinds[name], "partial"), idempotency_key: params.p_key };
  if (name === "list_context_request_targets")
    return [
      {
        subjectId: subject,
        kind: "recording",
        identityConfirmed: true,
        availableFields: ["isrc"],
        reusableModules: [],
      },
    ];
  if (name === "list_context_release_request_target")
    return {
      subjectId: subject,
      kind: "release",
      identityConfirmed: false,
      availableFields: ["spotify_id"],
      reusableModules: [],
    };
  if (name === "list_context_request_executions")
    return [
      {
        executionId: record,
        policyVersion: "synthetic-policy",
        createdAt: when,
        nodeCount: 1,
        outcomeCount: 0,
      },
    ];
  if (name === "read_context_execution")
    return {
      id: record,
      owner_id: owner,
      request_id: requestId,
      policy_version: "synthetic-policy",
      created_at: when,
      plan: [
        {
          key: `${subject}:musicbrainz`,
          subjectId: subject,
          module: "musicbrainz",
          state: "ready_for_dispatch",
          dependsOn: [],
        },
      ],
      outcomes: [],
      claims: [{ nodeKey: `${subject}:musicbrainz`, claimedAt: when, state: "unknown" }],
    };
  if (name === "list_context_catalog_members")
    return {
      catalogId: record,
      subjectId: subject,
      members: ["AAA000000001"],
      nextCursor: null,
      hasMore: false,
    };
  if (name === "expand_context_catalog_members")
    return {
      catalogId: record,
      catalogSubjectId: subject,
      members: [{ subjectId: record, isrc: "AAA000000001" }],
      nextCursor: null,
      hasMore: false,
    };
  if (name === "list_context_release_track_slots") return page;
  if (name === "review_context_release_track_identities") return identity;
  if (name === "list_context_release_cases")
    return {
      cases: [
        {
          request_id: requestId,
          url: releaseCase.release_url,
          created_at: when,
          status: "partial",
        },
      ],
      next_id: null,
      has_more: false,
    };
  if (name === "read_context_release_case") return releaseCase;
  if (name === "read_context_release_case_review" || name === "review_context_release_case")
    return review;
  if (name === "read_context_documents") {
    if (activeAction !== "read_release_track_observations") return [savedDocument];
    return [
      {
        subjectId: subject,
        topic: "spotify_release_track_isrcs",
        resultId: record,
        text: JSON.stringify({
          releaseSourceResultId: source,
          slots: [
            { slotIndex: 0, spotifyTrackId: spotify, state: "observed", isrc: "AAA000000001" },
          ],
          observations: [
            {
              spotifyTrackId: spotify,
              state: "observed",
              isrc: "AAA000000001",
              sourceUrl: trackUrl,
              retrievedAt: when,
              elapsedMs: 10,
              httpStatus: 200,
              gap: null,
            },
          ],
          observedIsrcCount: 1,
          missingIsrcCount: 0,
          failedLookupCount: 0,
          coverage: "full",
        }),
        sources: [{ versionId: version, url: trackUrl, retrievedAt: when }],
      },
    ];
  }
  if (name === "save_context_brief")
    return {
      id: record,
      created_at: when,
      purpose: "playlist_pitch",
      state: "saved",
      superseded: false,
      brief: params.p_snapshot,
    };
  if (name === "read_context_brief")
    return {
      id: record,
      created_at: when,
      purpose: "playlist_pitch",
      state: "unavailable",
      superseded: true,
      brief: null,
    };
  throw new Error(`Unexpected synthetic storage operation: ${name}`);
}
const outputs: unknown[] = [];
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("No network allowed in Context contract fixtures");
    }),
  );
  vi.stubEnv("CONTEXT_SPOTIFY_RELEASE_VERIFY_ENABLED", "true");
  vi.stubEnv("CONTEXT_SPOTIFY_RELEASE_TRACK_ISRC_ENABLED", "true");
  mocks.rpc.mockImplementation(storage);
  mocks.auth.mockResolvedValue({ accountId: actor });
  mocks.resolve.mockResolvedValue({ accountId: actor });
  mocks.access.mockResolvedValue(true);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
afterAll(() => {
  if (
    process.env.RECOUP_CONTEXT_EXAMPLES_OUTPUT &&
    outputs.length === contextOperationExampleInputs.length
  )
    writeFileSync(
      process.env.RECOUP_CONTEXT_EXAMPLES_OUTPUT,
      JSON.stringify(
        {
          evidence:
            "Synthetic auth/storage and mocked dispatch only; no provider/customer/collection or database call. Queue receipts are not completed work.",
          examples: outputs,
        },
        null,
        2,
      ) + "\n",
    );
});
function noUnexpectedDispatch(action: string) {
  expect(mocks.dispatch).toHaveBeenCalledTimes(action === "ingest" ? 2 : 0);
  expect(mocks.release).toHaveBeenCalledTimes(action === "verify_release" ? 2 : 0);
  expect(mocks.tracks).toHaveBeenCalledTimes(action === "verify_release_tracks" ? 2 : 0);
  expect(fetch).not.toHaveBeenCalled();
}

it.each(contextOperationExampleInputs)(
  "validates $action input and actual HTTP/MCP response against its own contract",
  async input => {
    const parsed = contextOperationSchema.parse(input);
    activeAction = parsed.action;
    const reference = contextResponseReferences[parsed.action];
    const name = reference.split("/")[2] as keyof typeof contextResponseSchemas;
    const schema = contextResponseSchemas[name];
    const response = await POST(
      new NextRequest("https://fixture.invalid/api/context", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    );
    expect(response.status).toBe(contextResponseStatusCodes[parsed.action]);
    const body = await response.json();
    expect(schema.parse(body)).toEqual(body);
    const result = await handleContextToolOperation(input, {
      authInfo: { extra: { oauth: true } },
    } as unknown as Parameters<typeof handleContextToolOperation>[1]);
    expect("isError" in result ? result.isError : false).not.toBe(true);
    expect(JSON.parse(result.content[0].text)).toEqual(body);
    expect(mocks.access).toHaveBeenCalledWith({ accountId: actor, organizationId: owner });
    for (const field of Object.keys(body)) {
      const missing = { ...body };
      delete missing[field];
      if (field !== "assessment_scope" && field !== "next_steps")
        expect(schema.safeParse(missing).success, `${parsed.action} requires ${field}`).toBe(false);
    }
    noUnexpectedDispatch(parsed.action);
    outputs.push({
      name: parsed.action,
      request: input,
      status: response.status,
      responseReference: reference,
      response: body,
    });
    // Export verified source examples even when the published fixture is stale,
    // while keeping fixture drift red until the owning docs producer refreshes it.
    const declared = published.operationExamples.find(example => example.name === parsed.action);
    expect(declared).toEqual(outputs.at(-1));
  },
);

it("covers each remaining original action rather than duplicating the four completed contracts", () => {
  const completed = [
    "attach_evidence",
    "read_evidence_attachment",
    "list_evidence_attachments",
    "plan_catalog_members",
  ];
  expect(contextOperationExampleInputs.map(input => input.action).sort()).toEqual(
    contextOperationSchema.options
      .map(option => option.shape.action.value)
      .filter(action => !completed.includes(action))
      .sort(),
  );
});

it("rejects identities supplied by callers and stops denied HTTP/MCP calls before storage", async () => {
  const input = contextOperationExampleInputs[0];
  const invalid = { ...input, account_id: actor };
  expect(contextOperationSchema.safeParse(invalid).success).toBe(false);
  mocks.auth.mockResolvedValue(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  mocks.resolve.mockResolvedValue({ error: "Unauthorized" });
  expect(
    (
      await POST(
        new NextRequest("https://fixture.invalid/api/context", {
          method: "POST",
          body: JSON.stringify(input),
        }),
      )
    ).status,
  ).toBe(401);
  const result = await handleContextToolOperation(
    input,
    {} as Parameters<typeof handleContextToolOperation>[1],
  );
  expect(result).toHaveProperty("isError", true);
  expect(mocks.rpc).not.toHaveBeenCalled();
  noUnexpectedDispatch("");
});

it("does not imply enabled verification or queue work when its existing flags are off", async () => {
  vi.stubEnv("CONTEXT_SPOTIFY_RELEASE_VERIFY_ENABLED", "false");
  vi.stubEnv("CONTEXT_SPOTIFY_RELEASE_TRACK_ISRC_ENABLED", "false");
  for (const action of ["verify_release", "verify_release_tracks"]) {
    const input = contextOperationExampleInputs.find(example => example.action === action)!;
    const response = await POST(
      new NextRequest("https://fixture.invalid/api/context", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    );
    expect(response.status).toBe(409);
  }
  expect(mocks.rpc).not.toHaveBeenCalled();
  noUnexpectedDispatch("");
});

it("preserves flexible retained JSON without exposing a claim token in the contract", async () => {
  const retained = {
    ...requestRecord(),
    input: ["historical", { retained: true }],
    output: "historical payload",
  };
  mocks.rpc.mockImplementation((name: string) => {
    if (name !== "read_context_request") throw new Error("Unexpected storage operation");
    return retained;
  });
  const input = contextOperationExampleInputs.find(example => example.action === "read")!;
  const response = await POST(
    new NextRequest("https://fixture.invalid/api/context", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  );
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(contextResponseSchemas.read.parse(body)).toEqual({ request: retained });
  expect(
    contextResponseSchemas.read.safeParse({
      request: { ...retained, claim_token: "synthetic-forbidden-field" },
    }).success,
  ).toBe(false);
  noUnexpectedDispatch("");
});

it("rejects a withheld snapshot payload or an unsupported rights capability being advertised", () => {
  expect(
    contextResponseSchemas.briefSnapshot.safeParse({
      snapshot: {
        id: record,
        created_at: when,
        purpose: "playlist_pitch",
        state: "unavailable",
        superseded: false,
        brief: {},
      },
    }).success,
  ).toBe(false);
  expect(
    contextResponseSchemas.releaseCaseReview.safeParse({ ...review, state: "unavailable" }).success,
  ).toBe(false);
  expect(
    contextResponseSchemas.releaseCase.safeParse({
      ...releaseCase,
      capabilities: { ...releaseCase.capabilities, distribute: "enabled" },
    }).success,
  ).toBe(false);
});

it("does not advertise unreachable public modules or excluded brief evidence", async () => {
  activeAction = "plan";
  const planInput = contextOperationExampleInputs.find(example => example.action === "plan")!;
  const planResponse = await POST(
    new NextRequest("https://fixture.invalid/api/context", {
      method: "POST",
      body: JSON.stringify(planInput),
    }),
  );
  const plan = await planResponse.json();
  expect(contextResponseSchemas.modulePlan.safeParse(plan).success).toBe(true);
  for (const module of ["mlc_search", "mlc_work", "release_expansion"])
    expect(
      contextResponseSchemas.modulePlan.safeParse({ ...plan, plan: [{ ...plan.plan[0], module }] })
        .success,
    ).toBe(false);
  expect(
    contextResponseSchemas.modulePlan.safeParse({
      ...plan,
      plan: [{ ...plan.plan[0], targetKind: "composition" }],
    }).success,
  ).toBe(false);
  activeAction = "brief";
  const briefInput = contextOperationExampleInputs.find(example => example.action === "brief")!;
  const briefResponse = await POST(
    new NextRequest("https://fixture.invalid/api/context", {
      method: "POST",
      body: JSON.stringify(briefInput),
    }),
  );
  const brief = await briefResponse.json();
  expect(contextResponseSchemas.brief.safeParse(brief).success).toBe(true);
  for (const change of [
    { status: "withdrawn" },
    { evidenceKind: "creative_proposal" },
    { coverage: "unavailable" },
    { coverage: "unknown" },
  ])
    expect(
      contextResponseSchemas.brief.safeParse({
        ...brief,
        documents: [{ ...brief.documents[0], ...change }],
      }).success,
    ).toBe(false);
  noUnexpectedDispatch("");
});
