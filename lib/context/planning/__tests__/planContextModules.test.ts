import { writeFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { planContextModules } from "../planContextModules";
const id = "00000000-0000-4000-8000-000000000001";
const base = {
  entry: "song" as const,
  targets: [
    {
      subjectId: id,
      kind: "recording" as const,
      identityConfirmed: true,
      availableFields: ["isrc" as const],
      reusableModules: [],
    },
  ],
  requested: [{ subjectId: id, module: "musicbrainz" as const }],
  permittedModules: ["musicbrainz" as const],
};
it("plans independent recording collectors without executing or inferring ownership", () => {
  const result = planContextModules({
    ...base,
    requested: [...base.requested, { subjectId: id, module: "mlc_recording" }],
    permittedModules: ["musicbrainz", "mlc_recording"],
  });
  expect(result.map(n => n.state)).toEqual(["ready_for_dispatch", "ready_for_dispatch"]);
  expect(
    result.every(
      n => !n.executionStarted && n.dependsOn.length === 0 && n.scope === "workspace_private",
    ),
  ).toBe(true);
});
it("requires confirmed identity, fields and policy; does not infer Spotify artist from ISRC", () => {
  expect(planContextModules({ ...base, permittedModules: [] })[0].state).toBe("blocked");
  expect(
    planContextModules({ ...base, targets: [{ ...base.targets[0], identityConfirmed: false }] })[0]
      .state,
  ).toBe("blocked");
  const [artist] = planContextModules({
    ...base,
    entry: "artist",
    targets: [{ ...base.targets[0], kind: "artist" }],
    requested: [{ subjectId: id, module: "songstats" }],
    permittedModules: ["songstats"],
  });
  expect(artist.reasons).toContain("Missing spotify_id");
});
it("offers checked evidence for reuse without fresh collection permission, but still requires identity", () => {
  const input = {
    ...base,
    targets: [
      { ...base.targets[0], availableFields: [], reusableModules: ["musicbrainz" as const] },
    ],
    permittedModules: [],
  };
  expect(planContextModules(input)[0].state).toBe("reuse_candidate");
  expect(
    planContextModules({
      ...input,
      targets: [{ ...input.targets[0], identityConfirmed: false }],
    })[0].state,
  ).toBe("blocked");
});
it.each(["company", "campaign", "release", "material", "songwriter"] as const)(
  "shows unimplemented %s collection explicitly",
  entry => {
    const modules = {
      company: "company_research",
      campaign: "campaign_context",
      release: "release_expansion",
      material: "material_extraction",
      songwriter: "songwriter_research",
    } as const;
    expect(
      planContextModules({
        entry,
        targets: [
          {
            subjectId: id,
            kind: entry,
            identityConfirmed: true,
            availableFields: [],
            reusableModules: [],
          },
        ],
        requested: [{ subjectId: id, module: modules[entry] }],
        permittedModules: [],
      })[0].state,
    ).toBe("not_implemented");
  },
);
it("allows catalog entry to plan confirmed member recordings without attaching track evidence to the catalog", () => {
  expect(planContextModules({ ...base, entry: "catalog" })[0].targetKind).toBe("recording");
  expect(() =>
    planContextModules({ ...base, targets: [{ ...base.targets[0], kind: "catalog" }] }),
  ).toThrow("target kind");
});
it("rejects unknown, duplicated targets and duplicate requests", () => {
  expect(() => planContextModules({ ...base, targets: [] })).toThrow("resolved");
  expect(() =>
    planContextModules({ ...base, targets: [...base.targets, ...base.targets] }),
  ).toThrow("Duplicate context target");
  expect(() =>
    planContextModules({ ...base, requested: [...base.requested, ...base.requested] }),
  ).toThrow("Duplicate requested module");
});

it("records a planning-only review across all eight entry types", async () => {
  const cases = [
    {
      entry: "artist",
      kind: "artist",
      module: "saved_socials",
      field: "artist_account_link",
      expected: "ready_for_dispatch",
    },
    {
      entry: "song",
      kind: "recording",
      module: "musicbrainz",
      field: "isrc",
      expected: "ready_for_dispatch",
    },
    {
      entry: "catalog",
      kind: "catalog",
      module: "catalog_valuation",
      field: "catalog_account_link",
      expected: "ready_for_dispatch",
    },
    { entry: "company", kind: "company", module: "company_research", expected: "not_implemented" },
    {
      entry: "campaign",
      kind: "campaign",
      module: "campaign_context",
      expected: "not_implemented",
    },
    { entry: "release", kind: "release", module: "release_expansion", expected: "not_implemented" },
    {
      entry: "material",
      kind: "material",
      module: "material_extraction",
      expected: "not_implemented",
    },
    {
      entry: "songwriter",
      kind: "songwriter",
      module: "songwriter_research",
      expected: "not_implemented",
    },
  ] as const;
  const steps = cases.map(item => {
    const input = {
      entry: item.entry,
      targets: [
        {
          subjectId: id,
          kind: item.kind,
          identityConfirmed: true,
          availableFields: "field" in item ? [item.field] : [],
          reusableModules: [],
        },
      ],
      requested: [{ subjectId: id, module: item.module }],
      permittedModules: [item.module],
    };
    const output = planContextModules(input);
    expect(output[0].state).toBe(item.expected);
    return { id: item.entry, title: `Plan ${item.entry} context`, status: "passed", input, output };
  });
  if (process.env.CONTEXT_ENTRY_PLAN_TRACE_PATH)
    await writeFile(
      process.env.CONTEXT_ENTRY_PLAN_TRACE_PATH,
      JSON.stringify(
        {
          id: "scenario-024",
          kind: "scenario",
          label: "Test run 24 · all-entry planning",
          title: "Requested modules, prerequisites and explicit build gaps",
          startedAt: new Date().toISOString(),
          outcome: "passed",
          environment: "Pure planner with server-policy fixtures; no provider or database calls",
          notes:
            "Passed means planning assertions passed, not context collection. Ready-for-dispatch requires an authorized runtime and deployed storage before execution. Unimplemented entries remain visible. This registry covers selected provider collectors, not the complete workflow.",
          steps,
        },
        null,
        2,
      ),
    );
});

it("plans saved release enrichment separately from unbuilt standalone release ingestion", () => {
  const result = planContextModules({
    entry: "release",
    targets: [
      {
        subjectId: id,
        kind: "release",
        identityConfirmed: true,
        availableFields: ["spotify_id"],
        reusableModules: [],
      },
    ],
    requested: [
      { subjectId: id, module: "spotify_release" },
      { subjectId: id, module: "release_expansion" },
    ],
    permittedModules: ["spotify_release"],
  });
  expect(result.map(item => item.state)).toEqual(["ready_for_dispatch", "not_implemented"]);
});
