import { beforeEach, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { verifyContextOriginal } from "../verifyContextOriginal";
import { authorizeContextOwner } from "../../authorizeContextOwner";
vi.mock("@/lib/supabase/storage/getContextOriginalFile", () => ({
  getContextOriginalFile: vi.fn(),
}));
vi.mock("../../authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));
const actor = "11111111-1111-4111-8111-111111111111";
const owner = "22222222-2222-4222-8222-222222222222";
const id = "33333333-3333-4333-8333-333333333333";
const key = `${owner}/context-originals/${id}.csv`;
const bytes = Buffer.from("title,amount\nSynthetic,12\n");
const load = vi.fn(async () => new Blob([bytes]));
beforeEach(() => {
  vi.clearAllMocks();
  load.mockResolvedValue(new Blob([bytes]));
  vi.mocked(authorizeContextOwner).mockResolvedValue({
    accountId: actor,
    ownerId: owner,
    organizationId: owner,
  });
});
it("fingerprints actual private bytes and checks current scope twice", async () => {
  const result = await verifyContextOriginal(actor, owner, key, load);
  expect(result).toEqual({
    bucket: "context-private",
    key,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    bytes: bytes.length,
    mediaType: "text/csv",
  });
  expect(load).toHaveBeenCalledExactlyOnceWith(key);
  expect(authorizeContextOwner).toHaveBeenCalledTimes(2);
  expect(authorizeContextOwner).toHaveBeenCalledWith(actor, owner);
});
it("uses personal scope without inventing an organization", async () => {
  await verifyContextOriginal(actor, actor, key.replace(owner, actor), load);
  expect(authorizeContextOwner).toHaveBeenCalledWith(actor, undefined);
});
it.each([
  key.replace(owner, actor),
  `${owner}/context-originals/../secret.csv`,
  `${key}?token=x`,
  key.replace(".csv", ".exe"),
])("denies malformed or foreign storage key before reading: %s", async value => {
  await expect(verifyContextOriginal(actor, owner, value, load)).rejects.toThrow();
  expect(load).not.toHaveBeenCalled();
});
it("denies initial scope loss and revocation during the file read", async () => {
  vi.mocked(authorizeContextOwner).mockRejectedValueOnce(new Error("denied"));
  await expect(verifyContextOriginal(actor, owner, key, load)).rejects.toThrow();
  expect(load).not.toHaveBeenCalled();
  vi.mocked(authorizeContextOwner)
    .mockResolvedValueOnce({ accountId: actor, ownerId: owner, organizationId: owner })
    .mockRejectedValueOnce(new Error("revoked"));
  await expect(verifyContextOriginal(actor, owner, key, load)).rejects.toThrow("revoked");
});
it.each([
  new Blob([]),
  new Blob([new Uint8Array([0xff, 0xfe])]),
  new Blob(["title\0secret"]),
  new Blob(["\0html"]),
])("rejects empty, binary or control-byte text originals", async blob => {
  load.mockResolvedValue(blob);
  await expect(verifyContextOriginal(actor, owner, key, load)).rejects.toThrow();
});
it("recognizes PDF container markers without claiming extraction or rights", async () => {
  load.mockResolvedValue(new Blob(["%PDF-1.7\nsynthetic\n%%EOF\n"]));
  expect(
    (await verifyContextOriginal(actor, owner, key.replace(".csv", ".pdf"), load)).mediaType,
  ).toBe("application/pdf");
});
it("changed bytes have a different fingerprint; exact retry preserves it", async () => {
  const first = await verifyContextOriginal(actor, owner, key, load);
  expect((await verifyContextOriginal(actor, owner, key, load)).sha256).toBe(first.sha256);
  load.mockResolvedValue(new Blob(["title,amount\nSynthetic,13\n"]));
  expect((await verifyContextOriginal(actor, owner, key, load)).sha256).not.toBe(first.sha256);
});

it("rejects a fake PDF header and oversized blob before reading its buffer", async () => {
  load.mockResolvedValueOnce(new Blob(["<html>not PDF</html>"]));
  await expect(
    verifyContextOriginal(actor, owner, key.replace(".csv", ".pdf"), load),
  ).rejects.toThrow();
  const arrayBuffer = vi.fn();
  load.mockResolvedValueOnce({ size: 50 * 1024 * 1024 + 1, arrayBuffer } as unknown as Blob);
  await expect(verifyContextOriginal(actor, owner, key, load)).rejects.toThrow();
  expect(arrayBuffer).not.toHaveBeenCalled();
});
