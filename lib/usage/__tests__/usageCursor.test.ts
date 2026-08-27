import { describe, it, expect } from "vitest";
import { encodeUsageCursor } from "@/lib/usage/encodeUsageCursor";
import { decodeUsageCursor } from "@/lib/usage/decodeUsageCursor";

const item = {
  id: "3AANn3Ij9uF-zZIlW_zlP",
  created_at: "2026-08-27T11:56:57.995Z",
  credits_deducted: 20000,
};

describe("usage cursors", () => {
  it("encodes the created_at cursor as the item's created_at", () => {
    expect(encodeUsageCursor("created_at", item)).toBe("2026-08-27T11:56:57.995Z");
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
      createdAt: "2026-08-27T11:56:57.000Z",
    });
  });

  it("returns null for a cursor that does not fit the sort", () => {
    expect(decodeUsageCursor("cost", "2026-08-27T11:56:57.995Z")).toBeNull();
    expect(decodeUsageCursor("cost", "abc:")).toBeNull();
    expect(decodeUsageCursor("created_at", "20000:abc")).toBeNull();
    expect(decodeUsageCursor("created_at", "yesterday")).toBeNull();
  });
});
