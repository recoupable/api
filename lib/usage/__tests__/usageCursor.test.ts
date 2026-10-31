import { describe, it, expect } from "vitest";
import { encodeUsageCursor } from "@/lib/usage/encodeUsageCursor";
import { decodeUsageCursor } from "@/lib/usage/decodeUsageCursor";

const item = {
  id: "3AANn3Ij9uF-zZIlW_zlP",
  created_at: "2026-08-27T11:56:57.995Z",
  credits_deducted: 20000,
};

describe("usage cursors", () => {
  it("encodes both time and ID in the versioned opaque cursor", () => {
    const cursor = encodeUsageCursor("created_at", item);
    expect(cursor).toMatch(/^v1:/);
    expect(JSON.parse(Buffer.from(cursor.slice(3), "base64url").toString())).toEqual([
      "2026-08-27T11:56:57.995000Z",
      item.id,
    ]);
    expect(decodeUsageCursor("created_at", cursor)).toEqual({
      createdAt: "2026-08-27T11:56:57.995000Z",
      id: item.id,
    });
  });

  it("encodes the cost cursor as credits_deducted:id", () => {
    expect(encodeUsageCursor("cost", item)).toBe("20000:3AANn3Ij9uF-zZIlW_zlP");
  });

  it("decodes a cost cursor back into the keyset pair", () => {
    expect(decodeUsageCursor("cost", "20000:3AANn3Ij9uF-zZIlW_zlP")).toEqual({
      creditsDeducted: 20000,
      id: "3AANn3Ij9uF-zZIlW_zlP",
    });
  });

  it("decodes a created_at cursor into a normalised ISO string", () => {
    expect(decodeUsageCursor("created_at", "2026-08-27T13:56:57+02:00")).toEqual({
      createdAt: "2026-08-27T11:56:57.000000Z",
    });
  });
  it.each([
    ["invalid", "valid-id"],
    ["2026-08-27T11:56:57.123456Z", "id),or(injected"],
    ["2026-08-27T11:56:57.123456Z"],
  ])("rejects malformed time keysets %j", (...values) => {
    const cursor = `v1:${Buffer.from(JSON.stringify(values)).toString("base64url")}`;
    expect(decodeUsageCursor("created_at", cursor)).toBeNull();
  });
  it("rejects filter syntax and unsafe integer amounts in cost cursors", () => {
    expect(decodeUsageCursor("cost", "1:id),or(injected")).toBeNull();
    expect(decodeUsageCursor("cost", "9007199254740992:id")).toBeNull();
  });

  it("returns null for a cursor that does not fit the sort", () => {
    expect(decodeUsageCursor("cost", "2026-08-27T11:56:57.995Z")).toBeNull();
    expect(decodeUsageCursor("cost", "abc:")).toBeNull();
    expect(decodeUsageCursor("created_at", "20000:abc")).toBeNull();
    expect(decodeUsageCursor("created_at", "yesterday")).toBeNull();
  });
});
