import { describe, expect, it } from "vitest";
import { canonicalizeChatAdmission } from "../canonicalizeChatAdmission";
import { encodeStrictJson } from "../encodeStrictJson";

const input = {
  contractVersion: "chat-admission/v1",
  effectiveAccountId: "11111111-1111-4111-8111-111111111111",
  sessionId: "session",
  chatId: "chat",
  expectedEpoch: 0,
  messages: [
    { id: "u1", role: "user", parts: [{ type: "text", text: "hello" }], metadata: { b: 2, a: 1 } },
  ],
  options: { modelId: "resolved-model" },
  executionSnapshot: { id: "snapshot-1", digest: "a".repeat(64) },
};

describe("chat-admission/v1 canonicalization", () => {
  it("matches the independently generated golden vector including explicit defaults", () => {
    const result = canonicalizeChatAdmission(input);
    expect(result.canonical).toBe(
      '{"chatId":"chat","contractVersion":"chat-admission/v1","effectiveAccountId":"11111111-1111-4111-8111-111111111111","executionSnapshot":{"digest":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","id":"snapshot-1"},"expectedEpoch":0,"messages":[{"id":"u1","metadata":{"a":1,"b":2},"parts":[{"text":"hello","type":"text"}],"role":"user"}],"options":{"artistId":null,"devSurface":null,"interactive":true,"modelId":"resolved-model"},"sessionId":"session"}',
    );
    expect(result.inputHash).toBe(
      "f6301c1adc4090c03508f9882b886c5aa54c3654aa0653e4bbc3750881a7284a",
    );
    expect(canonicalizeChatAdmission(result.envelope)).toEqual(result);
  });
  it("ignores recursive object order, but not full metadata/data parts or array order", () => {
    const original = canonicalizeChatAdmission(input).inputHash;
    expect(
      canonicalizeChatAdmission({
        ...input,
        messages: [
          { parts: input.messages[0].parts, metadata: { a: 1, b: 2 }, role: "user", id: "u1" },
        ],
      }).inputHash,
    ).toBe(original);
    for (const changed of [
      { ...input, messages: [{ ...input.messages[0], metadata: { a: 1, b: 3 } }] },
      {
        ...input,
        messages: [
          { ...input.messages[0], parts: [{ type: "data-fixture", data: { nested: [1, 2] } }] },
        ],
      },
      { ...input, effectiveAccountId: "22222222-2222-4222-8222-222222222222" },
      { ...input, executionSnapshot: { ...input.executionSnapshot, digest: "b".repeat(64) } },
      { ...input, expectedEpoch: 1 },
    ])
      expect(canonicalizeChatAdmission(changed).inputHash).not.toBe(original);
    expect(encodeStrictJson([1, 2])).not.toBe(encodeStrictJson([2, 1]));
  });
  it("normalizes absent defaults once without looking up mutable configuration", () => {
    expect(
      canonicalizeChatAdmission({
        ...input,
        options: { ...input.options, artistId: null, interactive: true, devSurface: null },
      }).inputHash,
    ).toBe(canonicalizeChatAdmission(input).inputHash);
    expect(() => canonicalizeChatAdmission({ ...input, options: {} })).toThrow();
  });
  it("sorts numeric object keys lexically, preserves Unicode and ECMAScript number encoding", () => {
    expect(encodeStrictJson({ "2": -0, "10": 0.125, é: "é", é: "é" })).toBe(
      '{"10":0.125,"2":0,"é":"é","é":"é"}',
    );
    expect(encodeStrictJson("é")).not.toBe(encodeStrictJson("é"));
  });
  it.each([
    undefined,
    NaN,
    Infinity,
    -Infinity,
    9007199254740992,
    BigInt(1),
    Symbol("x"),
    () => 1,
    new Date(),
    new Map(),
    new Set(),
    /x/,
  ])("rejects unsupported nested value %s", value => {
    expect(() =>
      canonicalizeChatAdmission({
        ...input,
        messages: [{ ...input.messages[0], metadata: { value } }],
      }),
    ).toThrow();
  });
  it("rejects cycles, sparse arrays, getters, symbols and custom prototypes without invoking them", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    const getter = Object.defineProperty({}, "secret", {
      enumerable: true,
      get() {
        throw new Error("GETTER EXECUTED");
      },
    });
    for (const value of [
      cyclic,
      Array(2),
      getter,
      { [Symbol("hidden")]: 1 },
      Object.create({ inherited: 1 }),
    ]) {
      expect(() => encodeStrictJson(value)).toThrow();
    }
    expect(() => encodeStrictJson(getter)).not.toThrow("GETTER EXECUTED");
  });
  it("rejects own __proto__ JSON keys before Zod can discard content", () => {
    const metadata = JSON.parse('{"__proto__":{"content":"must not disappear"}}');
    expect(() =>
      canonicalizeChatAdmission({ ...input, messages: [{ ...input.messages[0], metadata }] }),
    ).toThrow("Unsupported JSON key");
  });

  it("rejects credential fields, request ownership and unsupported options rather than silently stripping them", () => {
    for (const extra of [
      { recoupAccessToken: "Bearer synthetic" },
      { requestId: "request" },
      { owner: "owner" },
      { runId: "run" },
    ]) {
      expect(() => canonicalizeChatAdmission({ ...input, ...extra })).toThrow();
    }
    expect(() =>
      canonicalizeChatAdmission({
        ...input,
        executionSnapshot: { ...input.executionSnapshot, token: "synthetic" },
      }),
    ).toThrow();
    expect(() =>
      canonicalizeChatAdmission({ ...input, options: { ...input.options, token: "synthetic" } }),
    ).toThrow();
    expect(canonicalizeChatAdmission(input).canonical).not.toContain("Bearer");
  });
});
