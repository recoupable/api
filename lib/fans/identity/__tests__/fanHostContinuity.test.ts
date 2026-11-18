import { describe, expect, it } from "vitest";
import { decideFanHostContinuity as decide } from "../decideFanHostContinuity";
const model = () => ({
  operation: "returning_sign_in",
  binding: "existing",
  security: "active",
  campaign: "exhausted",
  now_ms: 1000,
  authenticated_at_ms: 900,
  policy: {
    max_auth_age_ms: 100,
    session_lifetime_ms: 60000,
    auth_admission: "admitted",
    new_registration_admission: "denied",
  },
});
describe("inactive bounded continuity model", () => {
  it.each(["returning_sign_in", "recovery", "disconnect"])(
    "selects bounded auth candidate for %s at exhaustion",
    operation => expect(decide({ ...model(), operation })).toBe("auth_lane_candidate"),
  );
  it("does not grant a token or mutate state", () => {
    const input = model();
    const before = structuredClone(input);
    expect(typeof decide(input)).toBe("string");
    expect(input).toEqual(before);
  });
  it.each(["revoked", "deleted"])(
    "security %s overrides funded or exhausted continuity",
    security => {
      for (const campaign of ["funded", "exhausted"])
        expect(decide({ ...model(), security, campaign })).toBe("denied");
    },
  );
  it.each([
    { binding: "unknown" },
    { security: "unknown" },
    { policy: undefined },
    { policy: null },
    { campaign: undefined },
    { extra: true },
    { now_ms: NaN },
    { now_ms: Infinity },
    { authenticated_at_ms: 1001 },
    { authenticated_at_ms: 899 },
  ])("fails closed %j", patch => expect(decide({ ...model(), ...patch })).toBe("unavailable"));
  it.each(["max_auth_age_ms", "session_lifetime_ms"])(
    "requires finite positive safe configured %s",
    field => {
      for (const n of [0, -1, Infinity, NaN, 1.1, Number.MAX_SAFE_INTEGER + 1])
        expect(decide({ ...model(), policy: { ...model().policy, [field]: n } })).toBe(
          "unavailable",
        );
    },
  );
  it("denies exhausted auth admission even for returning account", () =>
    expect(decide({ ...model(), policy: { ...model().policy, auth_admission: "denied" } })).toBe(
      "denied",
    ));
  it("missing auth admission is not allowed", () =>
    expect(decide({ ...model(), policy: { ...model().policy, auth_admission: undefined } })).toBe(
      "unavailable",
    ));
  it("new registration cannot use returning exception", () =>
    expect(decide({ ...model(), operation: "new_registration", binding: "absent" })).toBe(
      "denied",
    ));
  it("explicit separate admission can classify new registration without adopting policy", () =>
    expect(
      decide({
        ...model(),
        operation: "new_registration",
        binding: "absent",
        policy: { ...model().policy, new_registration_admission: "admitted" },
      }),
    ).toBe("registration_lane_candidate"));
  it("unknown new registration policy fails closed", () =>
    expect(
      decide({
        ...model(),
        operation: "new_registration",
        binding: "absent",
        policy: { ...model().policy, new_registration_admission: "unknown" },
      }),
    ).toBe("unavailable"));
  it("returning claim without known binding cannot bypass", () =>
    expect(decide({ ...model(), binding: "absent" })).toBe("denied"));
  it("existing binding is not a new registration", () =>
    expect(
      decide({
        ...model(),
        operation: "new_registration",
        policy: { ...model().policy, new_registration_admission: "admitted" },
      }),
    ).toBe("denied"));
  it("campaign work never inherits auth exception", () => {
    expect(decide({ ...model(), operation: "campaign_operation" })).toBe("denied");
    expect(decide({ ...model(), operation: "campaign_operation", campaign: "funded" })).toBe(
      "campaign_lane_candidate",
    );
  });
});

it("keeps registration admission independent from returning-auth admission", () =>
  expect(
    decide({
      ...model(),
      operation: "new_registration",
      binding: "absent",
      policy: {
        ...model().policy,
        auth_admission: "denied",
        new_registration_admission: "admitted",
      },
    }),
  ).toBe("registration_lane_candidate"));
it("does not use returning-auth admission for campaign classification", () =>
  expect(
    decide({
      ...model(),
      operation: "campaign_operation",
      campaign: "funded",
      policy: { ...model().policy, auth_admission: "denied" },
    }),
  ).toBe("campaign_lane_candidate"));

it("checks the exact safe session-expiry arithmetic boundary", () => {
  const lifetime = model().policy.session_lifetime_ms;
  const last = Number.MAX_SAFE_INTEGER - lifetime;
  expect(decide({ ...model(), now_ms: last, authenticated_at_ms: last })).toBe(
    "auth_lane_candidate",
  );
  expect(decide({ ...model(), now_ms: last + 1, authenticated_at_ms: last + 1 })).toBe(
    "unavailable",
  );
});
it.each(["funded", "exhausted"])(
  "returning authentication remains separately bounded when campaign is %s",
  campaign => expect(decide({ ...model(), campaign })).toBe("auth_lane_candidate"),
);
