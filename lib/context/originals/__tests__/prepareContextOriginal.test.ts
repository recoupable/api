import { beforeEach, expect, it, vi } from "vitest";
import { prepareContextOriginal } from "../prepareContextOriginal";
import { authorizeContextOwner } from "../../authorizeContextOwner";
vi.mock("../../authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));
vi.mock("@/lib/supabase/storage/getContextOriginalFile", () => ({
  getContextOriginalFile: vi.fn(),
}));
const actor = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  owner = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  sourceId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const input = { sourceId, idempotencyKey: "import-1", mediaType: "text/csv" };
function stream(text = "name,isrc\nSong,TEST12345\n") {
  return new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(new TextEncoder().encode(text));
      c.close();
    },
  });
}
beforeEach(() => vi.resetAllMocks());
it("prepares bounded bytes with stable scope/source/retry-derived object identity", async () => {
  const one = await prepareContextOriginal(actor, owner, input, stream());
  const retry = await prepareContextOriginal(
    actor.toUpperCase(),
    owner.toUpperCase(),
    { ...input, sourceId: sourceId.toUpperCase() },
    stream(),
  );
  expect(one.key).toEqual(retry.key);
  expect(one.sha256).toEqual(retry.sha256);
  expect(one.key).toMatch(new RegExp(`^${owner}/context-originals/[a-f0-9-]{36}\\.csv$`));
  expect(one.bytes).toBe(one.file.size);
  expect(await one.file.text()).toBe("name,isrc\nSong,TEST12345\n");
});
it("changed bytes retain the same retry object key but a different digest for conflict checks", async () => {
  const old = await prepareContextOriginal(actor, owner, input, stream());
  const changed = await prepareContextOriginal(
    actor,
    owner,
    input,
    stream("name,isrc\nChanged,TEST12345\n"),
  );
  expect(old.key).toBe(changed.key);
  expect(old.sha256).not.toBe(changed.sha256);
});
it("separates sources and retry keys", async () => {
  const first = await prepareContextOriginal(actor, owner, input, stream());
  for (const patch of [{ sourceId: actor }, { idempotencyKey: "next" }])
    expect(
      (await prepareContextOriginal(actor, owner, { ...input, ...patch }, stream())).key,
    ).not.toBe(first.key);
});
it.each(["sha256", "fileKey", "account_id"])(
  "rejects caller override %s without reading",
  async field => {
    const bytes = stream();
    await expect(
      prepareContextOriginal(actor, owner, { ...input, [field]: "override" }, bytes),
    ).rejects.toThrow();
    expect(bytes.locked).toBe(false);
  },
);
it("does not acquire reader before revoked workspace check", async () => {
  const bytes = stream();
  vi.mocked(authorizeContextOwner).mockRejectedValueOnce(new Error("Revoked"));
  await expect(prepareContextOriginal(actor, owner, input, bytes)).rejects.toThrow("Revoked");
  expect(bytes.locked).toBe(false);
});
it("withholds prepared bytes if access is revoked after consumption", async () => {
  vi.mocked(authorizeContextOwner)
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new Error("Revoked"));
  await expect(prepareContextOriginal(actor, owner, input, stream())).rejects.toThrow("Revoked");
});
