import { beforeEach, expect, it, vi } from "vitest";
import { verifyContextOriginal } from "../verifyContextOriginal";
const { download, from } = vi.hoisted(() => {
  const download = vi.fn();
  return { download, from: vi.fn(() => ({ download })) };
});
vi.mock("@/lib/supabase/serverClient", () => ({ default: { storage: { from } } }));
vi.mock("../../authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn(async () => ({})) }));
const actor = "11111111-1111-4111-8111-111111111111";
const key = `${actor}/context-originals/22222222-2222-4222-8222-222222222222.csv`;
beforeEach(() => vi.clearAllMocks());
it("the default domain path reads only the evidence-private bucket", async () => {
  download.mockResolvedValue({ data: new Blob(["title,amount\nSynthetic,12\n"]), error: null });
  expect((await verifyContextOriginal(actor, actor, key)).bytes).toBe(26);
  expect(from).toHaveBeenCalledExactlyOnceWith("context-private");
  expect(download).toHaveBeenCalledExactlyOnceWith(key);
});
it.each([
  { data: null, error: { message: "private backend detail" } },
  { data: new Blob([]), error: null },
  { data: { size: 50 * 1024 * 1024 + 1 }, error: null },
])("rejects unavailable, empty or oversized storage results", async result => {
  download.mockResolvedValue(result);
  await expect(verifyContextOriginal(actor, actor, key)).rejects.toThrow();
});
