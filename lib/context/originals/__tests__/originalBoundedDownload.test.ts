import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getContextOriginalFile } from "@/lib/supabase/storage/getContextOriginalFile";
const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));
vi.mock("@/lib/supabase/serverClient", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  return {
    default: createClient("https://storage.example.test", "synthetic-key", {
      global: { fetch: fetchMock },
    }),
  };
});
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("SUPABASE_URL", "https://storage.example.test");
  vi.stubEnv("SUPABASE_KEY", "synthetic-key");
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it("uses the installed SDK streaming path without materializing the HTTP Blob", async () => {
  const response = new Response("title,isrc\nSong,TEST\n");
  const blob = vi.spyOn(response, "blob");
  fetchMock.mockResolvedValue(response);
  expect(
    await (await getContextOriginalFile("owner/context-originals/object.original", 32)).text(),
  ).toBe("title,isrc\nSong,TEST\n");
  expect(blob).not.toHaveBeenCalled();
  expect(String(fetchMock.mock.calls[0][0])).toContain("/object/context-private/");
});
it("cancels oversized actual byte stream before Blob creation", async () => {
  const cancel = vi.fn();
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(new TextEncoder().encode("title,isrc\n"));
      c.enqueue(new TextEncoder().encode("Song,".repeat(20)));
    },
    cancel,
  });
  const response = new Response(stream);
  const blob = vi.spyOn(response, "blob");
  fetchMock.mockResolvedValue(response);
  await expect(getContextOriginalFile("object.original", 32)).rejects.toThrow();
  expect(cancel).toHaveBeenCalledOnce();
  expect(blob).not.toHaveBeenCalled();
});
it.each([0, -1, 1.5, 52428801, NaN])(
  "rejects invalid trusted download bound %s before SDK dispatch",
  async bound => {
    await expect(getContextOriginalFile("object.original", bound)).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  },
);
it("redacts a failed storage HTTP response", async () => {
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ message: "secret backend" }), { status: 403 }),
  );
  await expect(getContextOriginalFile("object.original", 32)).rejects.toThrow(
    /^Private original unavailable$/,
  );
});

it("aborts a stalled header request at the download deadline", async () => {
  vi.useFakeTimers();
  fetchMock.mockImplementation(
    (_url, options) =>
      new Promise((_resolve, reject) =>
        options?.signal?.addEventListener("abort", () => reject(new Error("aborted"))),
      ),
  );
  const result = getContextOriginalFile("object.original", 32);
  void result.catch(() => {});
  await vi.advanceTimersByTimeAsync(30001);
  try {
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    await expect(result).rejects.toThrow(/^Private original unavailable$/);
  } finally {
    vi.useRealTimers();
  }
});
it("returns on deadline even when header transport ignores abort", async () => {
  vi.useFakeTimers();
  fetchMock.mockImplementation(() => new Promise(() => {}));
  const rejected = expect(getContextOriginalFile("object.original", 32)).rejects.toThrow(
    /^Private original unavailable$/,
  );
  await vi.advanceTimersByTimeAsync(30001);
  await rejected;
});
it("shares one deadline across delayed headers and stalled body", async () => {
  vi.useFakeTimers();
  const cancel = vi.fn();
  fetchMock.mockImplementation(
    () =>
      new Promise(resolve =>
        setTimeout(() => resolve(new Response(new ReadableStream({ cancel }))), 20000),
      ),
  );
  const rejected = expect(getContextOriginalFile("object.original", 32)).rejects.toThrow(
    "disconnected",
  );
  await vi.advanceTimersByTimeAsync(30001);
  await rejected;
  expect(cancel).toHaveBeenCalledOnce();
});
