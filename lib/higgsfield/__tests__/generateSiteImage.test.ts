import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { generateSiteImage } from "../generateSiteImage";
const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubEnv("HF_CREDENTIALS", "test-id:test-secret");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
const json = (body: unknown) => new Response(JSON.stringify(body));
const accepted = {
  request_id: "job-1",
  status: "queued",
  status_url: "https://api.higgsfield.ai/requests/job-1/status",
};
it("submits once, records acceptance before polling, and returns completed image provenance", async () => {
  const checkpoint = vi.fn();
  fetchMock.mockResolvedValueOnce(json(accepted)).mockImplementationOnce(async () => {
    expect(checkpoint).toHaveBeenCalledWith(accepted);
    return json({
      request_id: "job-1",
      status: "completed",
      images: [{ url: "https://images.higgs.ai/art.webp" }],
    });
  });
  const result = await generateSiteImage(
    { prompt: "paper moon", aspectRatio: "16:9", style: "illustration" },
    checkpoint,
  );
  expect(result).toMatchObject({
    requestId: "job-1",
    model: "recraft/v4.1/text-to-image",
    url: "https://images.higgs.ai/art.webp",
    usd: 0.035,
  });
  expect(fetchMock.mock.calls[0][0]).toBe("https://api.higgsfield.ai/recraft/v4.1/text-to-image");
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
    aspect_ratio: "16:9",
    output_format: "webp",
  });
});
it("never forwards credentials to an untrusted status URL", async () => {
  fetchMock.mockResolvedValueOnce(json({ ...accepted, status_url: "https://evil.test/status" }));
  await expect(
    generateSiteImage({ prompt: "x", aspectRatio: "1:1", style: "photographic" }),
  ).rejects.toThrow("status URL");
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
it("reports terminal failure without submitting another paid generation or leaking response text", async () => {
  fetchMock
    .mockResolvedValueOnce(json(accepted))
    .mockResolvedValueOnce(json({ status: "failed", error: "test-secret" }));
  await expect(
    generateSiteImage({ prompt: "x", aspectRatio: "1:1", style: "photographic" }),
  ).rejects.toThrow("job-1 failed");
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
it("identifies an unfunded API account without leaking arbitrary provider response text", async () => {
  fetchMock.mockResolvedValueOnce(
    new Response(JSON.stringify({ detail: "not_enough_credits" }), { status: 403 }),
  );
  await expect(
    generateSiteImage({ prompt: "x", aspectRatio: "1:1", style: "illustration" }),
  ).rejects.toThrow("Higgsfield API credits are empty");
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
