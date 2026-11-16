import { describe, expect, it } from "vitest";
import { transition } from "../contractModel";

const binding = {
  workspace: "workspace-a",
  application: "app-a",
  environment: "production",
  origin: "https://music.example",
};
const empty = () => ({ binding, revision: 0, revoked: false, pending: null, validUntil: null });
const command = (type: string, revision: number, extra = {}) => ({
  type,
  expectedRevision: revision,
  binding,
  authorized: true,
  now: 1000,
  ...extra,
});
const token = "A".repeat(43);
const issued = () => transition(empty(), command("issue", 0, { token }));
const observation = {
  name: "_recoup-app.music.example",
  records: [[`recoup-app-v1=${token}`]],
  queriedAt: 1000,
  outcome: "answer",
};
const verify = (extra = {}) => command("verify", 1, { observation, ...extra });

describe("offline application domain-proof contract", () => {
  it("requires the full binding and current authority for every mutation", () => {
    for (const field of Object.keys(binding)) {
      expect(() =>
        transition(issued(), verify({ binding: { ...binding, [field]: "other" } })),
      ).toThrow("binding");
    }
    expect(() => transition(issued(), verify({ authorized: false }))).toThrow("authority");
  });
  it("accepts split TXT strings in one record, consumes the challenge, and bounds the lease", () => {
    const next = transition(
      issued(),
      verify({ observation: { ...observation, records: [["recoup-app-v1=", token]] } }),
    );
    expect(next.pending).toBeNull();
    expect(next.validUntil).toBe(1000 + 7 * 86400000);
    expect(() => transition(next, command("verify", 2, { observation }))).toThrow("challenge");
    expect(() => transition(next, verify())).toThrow("revision");
  });
  it("rejects expiry at its boundary, stale/future observations and failed lookups", () => {
    for (const extra of [
      { now: 1000 + 3600000, observation: { ...observation, queriedAt: 1000 + 3600000 } },
      { now: 61001 },
      { observation: { ...observation, queriedAt: 1001 } },
      { observation: { ...observation, outcome: "timeout" } },
      { observation: { ...observation, queriedAt: 999 } },
    ])
      expect(() => transition(issued(), verify(extra))).toThrow();
  });
  it("never joins different TXT records or accepts suffixes, alternate names or old tokens", () => {
    for (const changed of [
      { records: [["recoup-app-v1="], [token]] },
      { records: [[`recoup-app-v1=${token}extra`]] },
      { name: "_recoup-app.example" },
      { records: [[`recoup-app-v1=${"B".repeat(43)}`]] },
    ])
      expect(() =>
        transition(issued(), verify({ observation: { ...observation, ...changed } })),
      ).toThrow();
  });
  it("rotation invalidates in-flight checks; revocation blocks outstanding challenges", () => {
    const rotated = transition(issued(), command("issue", 1, { token: "B".repeat(43) }));
    expect(() => transition(rotated, verify())).toThrow("revision");
    expect(() => transition(rotated, command("verify", 2, { observation }))).toThrow("proof");
    const revoked = transition(issued(), command("revoke", 1));
    expect(revoked.pending).toBeNull();
    expect(revoked.validUntil).toBeNull();
    expect(() => transition(revoked, command("issue", 2, { token }))).toThrow("revoked");
  });
  it("renewal retains only the existing lease until fresh proof succeeds", () => {
    const verified = transition(issued(), verify());
    const renewal = transition(verified, command("issue", 2, { now: 2000, token: "B".repeat(43) }));
    expect(renewal.validUntil).toBe(verified.validUntil);
    expect(() => transition(renewal, command("verify", 3, { now: 2000, observation }))).toThrow();
    const renewed = transition(
      renewal,
      command("verify", 3, {
        now: 2000,
        observation: {
          ...observation,
          queriedAt: 2000,
          records: [[`recoup-app-v1=${"B".repeat(43)}`]],
        },
      }),
    );
    expect(renewed.validUntil).toBe(2000 + 7 * 86400000);
  });
});
