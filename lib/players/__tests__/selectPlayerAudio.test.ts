import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { selectPlayerAudio } from "@/lib/supabase/storage/selectPlayerAudio";
const m = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("@/lib/supabase/serverClient", () => ({
  default: { storage: { from: () => ({ list: m.list }) } },
}));
const owner = "10000000-0000-4000-8000-000000000001",
  name = "10000000-0000-4000-8000-000000000002.mp3";
const url = `https://storage.test/storage/v1/object/public/site-assets/${owner}/${name}`;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SUPABASE_URL", "https://storage.test");
  m.list.mockResolvedValue({ data: [{ name, metadata: { mimetype: "audio/mpeg" } }], error: null });
});
afterEach(() => vi.unstubAllEnvs());
it("requires an existing audio object in the current workspace", async () => {
  expect(await selectPlayerAudio(owner, url)).toBe(true);
  expect(m.list).toHaveBeenCalledWith(owner, expect.objectContaining({ search: name }));
  m.list.mockResolvedValueOnce({
    data: [{ name, metadata: { mimetype: "image/jpeg" } }],
    error: null,
  });
  expect(await selectPlayerAudio(owner, url)).toBe(false);
  m.list.mockResolvedValueOnce({ data: [], error: null });
  expect(await selectPlayerAudio(owner, url)).toBe(false);
});
it.each([
  url.replace(owner, "another-owner"),
  url + "?token=x",
  url.replace(name, "../secret.mp3"),
  url.replace("https://storage.test", "https://evil.test"),
])("rejects wrong ownership, traversal and arbitrary URLs: %s", async value => {
  expect(await selectPlayerAudio(owner, value)).toBe(false);
  expect(m.list).not.toHaveBeenCalled();
});
it("fails closed on storage lookup errors", async () => {
  m.list.mockResolvedValueOnce({ data: null, error: { message: "Unavailable" } });
  await expect(selectPlayerAudio(owner, url)).rejects.toThrow("Audio storage lookup unavailable");
});
