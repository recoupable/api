import { beforeEach, expect, it, vi } from "vitest";
import { verifyContextOriginal } from "../verifyContextOriginal";
import { authorizeContextOwner } from "../../authorizeContextOwner";
vi.mock("../../authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));
vi.mock("@/lib/supabase/storage/getContextOriginalFile", () => ({
  getContextOriginalFile: vi.fn(),
}));
const actor = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  owner = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const key = `${owner}/context-originals/cccccccc-cccc-4ccc-8ccc-cccccccccccc.csv`;
const load = vi.fn(async () => new Blob(["title,value\nSynthetic,1\n"]));
beforeEach(() => vi.clearAllMocks());
it("normalizes valid uppercase UUIDs before scope/key comparison", async () => {
  expect(
    (await verifyContextOriginal(actor.toUpperCase(), owner.toUpperCase(), key, load)).key,
  ).toBe(key);
  expect(authorizeContextOwner).toHaveBeenCalledWith(actor, owner);
});
it.each(["\n", "\r\n"])("denies trailing line terminator %j before scope/read", async suffix => {
  await expect(verifyContextOriginal(actor, owner, key + suffix, load)).rejects.toThrow(
    "workspace",
  );
  expect(load).not.toHaveBeenCalled();
  expect(authorizeContextOwner).not.toHaveBeenCalled();
});

it.each(["title,value\nSynthetic,1\n", "%PDF-1.7\nfixture\n%%EOF"])(
  "verifies actual type on neutral object paths",
  async text => {
    const result = await verifyContextOriginal(
      actor,
      owner,
      key.replace(/\.csv$/, ".original"),
      async () => new Blob([text]),
    );
    expect(result.mediaType).toBe(text.startsWith("%PDF-") ? "application/pdf" : "text/csv");
  },
);
