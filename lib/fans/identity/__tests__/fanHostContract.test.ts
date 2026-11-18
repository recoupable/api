import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parseFanHostIntent } from "../parseFanHostIntent";
import { assertFanHostReceiptMatchesIntent as match } from "../assertFanHostReceiptMatchesIntent";
import { decideFanHostLinkConflict as decide } from "../decideFanHostLinkConflict";

const intent = {
  version: 1,
  purpose: "link_existing_host",
  operation_id: "op-1",
  customer_id: "customer-1",
  application_id: "app-1",
  environment: "production",
  intended_recipient: "backend-1",
  return_url: "https://host.example/callback",
  initiation_id: "nonce-1",
  expected_application_revision: 1,
  expected_identity_revision: 2,
  fan_id: "fan-1",
  host_account_id: "host-1",
  host_session_reference: "session-1",
  host_session_generation: 3,
  expected_mapping_revision: 0,
};
const signIn = () => {
  const {
    host_account_id,
    host_session_reference,
    host_session_generation,
    expected_mapping_revision,
    ...value
  } = intent;
  void [
    host_account_id,
    host_session_reference,
    host_session_generation,
    expected_mapping_revision,
  ];
  return { ...value, purpose: "host_sign_in" };
};
const receipt = () => ({
  version: 1,
  receipt_id: "receipt-1",
  intent: { ...intent },
  outcome: "existing_host_linked",
  host_account_id: "host-1",
  fan_id: "fan-1",
  mapping_revision: 1,
  recorded_at: "2026-11-18T12:00:00.000Z",
});
const scope = { customer_id: "customer-1", application_id: "app-1", environment: "production" };
const model = () => ({
  intent: { ...intent },
  host_account_id: "host-1",
  scope: { ...scope },
  host_mapping: { state: "absent" },
  fan_mapping: { state: "absent" },
  security: "active",
  reassign: false,
});
describe("inactive fan host shape and consistency, never authentication", () => {
  it("parses both purposes without modifying input", () => {
    expect(parseFanHostIntent(intent)).toEqual(intent);
    expect(parseFanHostIntent(signIn()).purpose).toBe("host_sign_in");
  });
  it.each(["unknown", "host_account_id"])("rejects sign-in extra/link field %s", field =>
    expect(() => parseFanHostIntent({ ...signIn(), [field]: "x" })).toThrow(),
  );
  it.each([
    "operation_id",
    "customer_id",
    "application_id",
    "intended_recipient",
    "fan_id",
    "host_session_reference",
  ])("rejects missing %s", field => {
    const value: Record<string, unknown> = { ...intent };
    delete value[field];
    expect(() => parseFanHostIntent(value)).toThrow();
  });
  it.each(["", "\u0000", "\ud800", "\udc00", "x\ud800a"])("rejects invalid opaque IDs", value =>
    expect(() => parseFanHostIntent({ ...intent, operation_id: value })).toThrow(),
  );
  it.each([" key 🚀 ", "\\u0000", "é", "e\u0301"])("preserves exact opaque IDs", value =>
    expect(parseFanHostIntent({ ...intent, operation_id: value }).operation_id).toBe(value),
  );
  it.each([-1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1])("rejects unsafe revision %s", n =>
    expect(() => parseFanHostIntent({ ...intent, expected_identity_revision: n })).toThrow(),
  );
  it.each([
    "http://host.example/a",
    "https://name:password@host.example/a",
    "https://host.example/a#fragment",
    "https://host.example/a#",
    " https://host.example/a",
    "https://HOST.example/a",
  ])("rejects noncanonical or unsafe return target", return_url =>
    expect(() => parseFanHostIntent({ ...intent, return_url })).toThrow(),
  );
  it("accepts matching link receipt as data only", () =>
    expect(match(receipt(), intent)).toEqual(receipt()));
  it("accepts sign-in created/selected data without authorizing session issuance", () => {
    for (const outcome of ["host_mapping_selected", "host_mapping_created"])
      expect(match({ ...receipt(), intent: signIn(), outcome }, signIn()).outcome).toBe(outcome);
  });
  it.each([
    "customer_id",
    "application_id",
    "environment",
    "intended_recipient",
    "initiation_id",
    "fan_id",
    "operation_id",
    "host_account_id",
  ])("rejects changed receipt intent %s", field =>
    expect(() =>
      match({ ...receipt(), intent: { ...intent, [field]: "changed" } }, intent),
    ).toThrow(),
  );
  it.each([
    { host_account_id: "other" },
    { fan_id: "other" },
    { mapping_revision: 0 },
    { outcome: "host_mapping_created" },
    { recorded_at: "2026-02-30T12:00:00.000Z" },
    { recorded_at: "2026-11-18T12:00:00+00:00" },
    { extra: true },
  ])("rejects invalid receipt %j", patch =>
    expect(() => match({ ...receipt(), ...patch }, intent)).toThrow(),
  );
  it("explicit counterexample: attacker-controlled well-shaped JSON matches, but proves no authority", () => {
    const forged = JSON.parse(JSON.stringify(receipt()));
    expect(match(forged, forged.intent)).toEqual(forged);
    expect(Object.keys(match(forged, forged.intent))).not.toContain("authenticated");
  });
  it("rejects changed intent on original-result comparison (not replay protection)", () =>
    expect(() => match(receipt(), { ...intent, operation_id: "different" })).toThrow());
});
describe("pure conflict observations", () => {
  it("classifies absent mapping without committing", () => {
    const value = model();
    const before = structuredClone(value);
    expect(decide(value)).toBe("needs_atomic_mapping_check");
    expect(value).toEqual(before);
  });
  it("requires agreement in both directions", () =>
    expect(
      decide({
        ...model(),
        host_mapping: { state: "present", fan_id: "fan-1", revision: 0 },
        fan_mapping: { state: "present", host_account_id: "host-1" },
      }),
    ).toBe("unchanged_candidate"));
  it.each([
    { host_mapping: { state: "present", fan_id: "other", revision: 0 } },
    { fan_mapping: { state: "present", host_account_id: "other" } },
  ])("denies conflicting ownership %j", patch =>
    expect(decide({ ...model(), ...patch })).toBe("conflict"),
  );
  it.each([
    { host_mapping: undefined },
    { fan_mapping: undefined },
    { security: "unknown" },
    { scope: { ...scope, environment: "development" } },
    { host_mapping: { state: "absent", fan_id: "hidden" } },
    { host_mapping: { state: "present", fan_id: "fan-1", revision: 9 } },
  ])("fails closed on incomplete/stale observations %j", patch =>
    expect(decide({ ...model(), ...patch })).toBe("unavailable"),
  );
  it("rejects link host substitution", () =>
    expect(decide({ ...model(), host_account_id: "other" })).toBe("unavailable"));
  it("requires recovery for reassignment/deletion and denies revocation", () => {
    expect(decide({ ...model(), reassign: true })).toBe("recovery_required");
    expect(decide({ ...model(), security: "deleted" })).toBe("recovery_required");
    expect(decide({ ...model(), security: "revoked" })).toBe("denied");
  });
  it("does not infer a consistent mapping from one present direction", () =>
    expect(
      decide({ ...model(), host_mapping: { state: "present", fan_id: "fan-1", revision: 0 } }),
    ).toBe("unavailable"));
  it("independently models another app without granting cross-app access", () => {
    const value = model();
    value.intent.application_id = "app-2";
    value.scope.application_id = "app-2";
    expect(decide(value)).toBe("needs_atomic_mapping_check");
  });
});
it("has no authority runtime imports or environment access", () => {
  for (const name of [
    "parseFanHostIntent",
    "assertFanHostReceiptMatchesIntent",
    "decideFanHostLinkConflict",
    "decideFanHostContinuity",
  ]) {
    const source = readFileSync(new URL("../" + name + ".ts", import.meta.url), "utf8");
    expect(source).not.toMatch(
      /process\.env|fetch\(|node:crypto|supabase|registerTool|NextRequest|createClient/,
    );
    const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map(m => m[1]);
    expect(
      imports.every(p => p === "zod" || p === "./parseFanHostIntent" || p === "node:util"),
    ).toBe(true);
  }
});

it("rejects exhausted mapping revisions and accepts the last representable transition", () => {
  const exhausted = { ...intent, expected_mapping_revision: Number.MAX_SAFE_INTEGER };
  expect(() => parseFanHostIntent(exhausted)).toThrow();
  expect(
    decide({
      ...model(),
      intent: exhausted,
      host_mapping: { state: "present", fan_id: "fan-1", revision: Number.MAX_SAFE_INTEGER },
      fan_mapping: { state: "present", host_account_id: "host-1" },
    }),
  ).toBe("unavailable");
  const last = { ...intent, expected_mapping_revision: Number.MAX_SAFE_INTEGER - 1 };
  expect(
    match({ ...receipt(), intent: last, mapping_revision: Number.MAX_SAFE_INTEGER }, last)
      .mapping_revision,
  ).toBe(Number.MAX_SAFE_INTEGER);
});
it("preserves an encoded hash in the path", () =>
  expect(parseFanHostIntent({ ...intent, return_url: "https://host.example/%23" }).return_url).toBe(
    "https://host.example/%23",
  ));
