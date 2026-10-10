import { describe, expect, it, vi } from "vitest";
import { contextOperationSchema, processContextOperation } from "../processContextOperation";

vi.mock("../authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));

const actor = "00000000-0000-4000-8000-000000000001";
const workspace = "00000000-0000-4000-8000-000000000002";
const firstRecording = "00000000-0000-4000-8000-000000000011";
const secondRecording = "00000000-0000-4000-8000-000000000012";
const lettered = "0000000a-0000-4000-8000-0000000000ab";

const authorized = () =>
  vi.fn(async () => ({ accountId: actor, ownerId: workspace, organizationId: workspace }));

describe("unreleased recording intake", () => {
  it("saves a submitted title under an internal identity without dispatch or identifiers", async () => {
    const rpc = vi.fn(async () => ({
      id: "request",
      status: "partial",
      input: { kind: "unreleased_recording", title: "Night drive", identityConfirmed: false },
      output: { subjectIds: ["subject"], gaps: ["ISRC not assigned"] },
    }));
    const dispatch = vi.fn();
    const authorize = authorized();
    const result = await processContextOperation(
      actor,
      {
        action: "ingest_unreleased_recording",
        recording: {
          title: "  Night drive  ",
          working_title: "ND v3",
          lifecycle_state: "mixed",
          planned_release_date: "2027-03-05",
        },
        organization_id: workspace,
        idempotency_key: "recording-1",
      },
      { authorize, rpc, dispatch },
    );
    expect(authorize).toHaveBeenCalledWith(actor, workspace);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("create_context_unreleased_recording_request", {
      p_owner: workspace,
      p_actor: actor,
      p_recording: {
        title: "Night drive",
        working_title: "ND v3",
        lifecycle_state: "mixed",
        planned_release_date: "2027-03-05",
      },
      p_key: "recording-1",
    });
    expect("request" in result && result.request?.status).toBe("partial");
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("rejects supplied ISRC, UPC, store or Spotify identifiers before authorization and storage", async () => {
    const authorize = vi.fn();
    const rpc = vi.fn();
    // Positive control: without the identifier key the same payload is a valid intake.
    expect(
      contextOperationSchema.safeParse({
        action: "ingest_unreleased_recording",
        recording: { title: "Night drive" },
        idempotency_key: "recording-1",
      }).success,
    ).toBe(true);
    for (const identifier of [
      { isrc: "supplied" },
      { upc: "supplied" },
      { store_ids: { spotify: "supplied" } },
      { spotify_id: "supplied" },
    ]) {
      await expect(
        processContextOperation(
          actor,
          {
            action: "ingest_unreleased_recording",
            recording: { title: "Night drive", ...identifier },
            idempotency_key: "recording-1",
          },
          { authorize, rpc, dispatch: vi.fn() },
        ),
      ).rejects.toThrow();
    }
    expect(authorize).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects an unknown lifecycle state, a short title, control characters and a malformed date", () => {
    const valid = {
      action: "ingest_unreleased_recording",
      recording: { title: "Night drive" },
      idempotency_key: "recording-1",
    };
    for (const recording of [
      { title: "Night drive", lifecycle_state: "released" },
      { title: "N" },
      { title: "Night\tdrive" },
      { title: "Night drive", working_title: "ND\u0007" },
      { title: "Night drive", planned_release_date: "March 2027" },
    ]) {
      const parsed = contextOperationSchema.safeParse({ ...valid, recording });
      expect(parsed.success).toBe(false);
      expect(parsed.error?.issues[0]?.path[0]).toBe("recording");
    }
  });
});

describe("planned release intake", () => {
  const release = {
    title: "Night Drive EP",
    lifecycle_state: "scheduled",
    planned_release_date: "2027-03-05",
    products: [{ format: "digital_ep" }, { format: "vinyl", label: "Limited pressing" }],
    promotional_links: [{ kind: "pre_save", url: "https://example.com/presave" }],
    recording_subject_ids: [firstRecording, secondRecording],
  };

  it("forwards lifecycle, products, promotional links and recording references unchanged", async () => {
    const rpc = vi.fn(async () => ({ id: "request", status: "partial" }));
    const dispatch = vi.fn();
    const authorize = authorized();
    const result = await processContextOperation(
      actor,
      { action: "ingest_planned_release", release, idempotency_key: "release-a" },
      { authorize, rpc, dispatch },
    );
    expect(authorize).toHaveBeenCalledWith(actor, undefined);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("create_context_planned_release_request", {
      p_owner: workspace,
      p_actor: actor,
      p_release: release,
      p_key: "release-a",
    });
    expect("request" in result && result.request?.status).toBe("partial");
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("accepts the same recording on two separate planned releases", async () => {
    const rpc = vi.fn(async () => ({ id: "request", status: "partial" }));
    const deps = { authorize: authorized(), rpc, dispatch: vi.fn() };
    for (const [title, key] of [
      ["Night Drive EP", "release-a"],
      ["Night Drive (single)", "release-b"],
    ] as const) {
      await processContextOperation(
        actor,
        {
          action: "ingest_planned_release",
          release: { title, lifecycle_state: "planned", recording_subject_ids: [firstRecording] },
          idempotency_key: key,
        },
        deps,
      );
    }
    expect(rpc).toHaveBeenCalledTimes(2);
    for (const call of rpc.mock.calls as unknown as [string, { p_release: typeof release }][])
      expect(call[1].p_release.recording_subject_ids).toEqual([firstRecording]);
    expect(deps.dispatch).not.toHaveBeenCalled();
  });

  it("forwards an omitted lifecycle so the database records it as unknown", async () => {
    const rpc = vi.fn(async () => ({ id: "request", status: "partial" }));
    await processContextOperation(
      actor,
      {
        action: "ingest_planned_release",
        release: { title: "Untitled album" },
        idempotency_key: "release-c",
      },
      { authorize: authorized(), rpc, dispatch: vi.fn() },
    );
    expect(rpc).toHaveBeenCalledExactlyOnceWith("create_context_planned_release_request", {
      p_owner: workspace,
      p_actor: actor,
      p_release: { title: "Untitled album" },
      p_key: "release-c",
    });
  });

  it("rejects store identifiers, invalid lifecycle, too many links and non-http links", async () => {
    const authorize = vi.fn();
    const rpc = vi.fn();
    // Positive control: the unmodified release is a valid intake.
    expect(
      contextOperationSchema.safeParse({
        action: "ingest_planned_release",
        release,
        idempotency_key: "release-a",
      }).success,
    ).toBe(true);
    const invalid = [
      { ...release, store_ids: { spotify: "supplied" } },
      { ...release, upc: "supplied" },
      { ...release, isrc: "supplied" },
      { ...release, lifecycle_state: "released" },
      { ...release, lifecycle_state: null },
      { ...release, title: "Night\tDrive EP" },
      { ...release, products: [{ format: "vinyl", label: "Limited\u0000pressing" }] },
      {
        ...release,
        promotional_links: Array.from({ length: 21 }, (_, index) => ({
          kind: "teaser",
          url: `https://example.com/${index}`,
        })),
      },
      { ...release, promotional_links: [{ kind: "pre_save", url: "spotify:album:placeholder" }] },
      { ...release, promotional_links: [{ kind: "pre_save", url: "HTTPS://example.com/presave" }] },
      {
        ...release,
        promotional_links: [{ kind: "pre_save", url: "https://example.com/pre save" }],
      },
      { ...release, products: [{ format: "minidisc" }] },
      { ...release, recording_subject_ids: ["not-a-uuid"] },
      { ...release, recording_subject_ids: [firstRecording, firstRecording] },
      { ...release, recording_subject_ids: [lettered, lettered.toUpperCase()] },
    ];
    for (const candidate of invalid) {
      const parsed = contextOperationSchema.safeParse({
        action: "ingest_planned_release",
        release: candidate,
        idempotency_key: "release-a",
      });
      expect(parsed.success).toBe(false);
      await expect(
        processContextOperation(
          actor,
          { action: "ingest_planned_release", release: candidate, idempotency_key: "release-a" },
          { authorize, rpc, dispatch: vi.fn() },
        ),
      ).rejects.toThrow();
    }
    expect(authorize).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("does not store anything when workspace access is denied", async () => {
    const rpc = vi.fn();
    await expect(
      processContextOperation(
        actor,
        { action: "ingest_planned_release", release, idempotency_key: "release-a" },
        {
          rpc,
          dispatch: vi.fn(),
          authorize: vi.fn(async () => {
            throw new Error("Access denied");
          }),
        },
      ),
    ).rejects.toThrow("Access denied");
    expect(rpc).not.toHaveBeenCalled();
  });
});
