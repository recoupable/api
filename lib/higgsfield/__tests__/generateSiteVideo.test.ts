import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { generateSiteVideo } from "../generateSiteVideo";
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
  status_url: "https://platform.higgsfield.ai/requests/job-1/status",
};
it("submits once, records acceptance before polling, and returns completed video provenance", async () => {
  const checkpoint = vi.fn();
  fetchMock.mockResolvedValueOnce(json(accepted)).mockImplementationOnce(async () => {
    expect(checkpoint).toHaveBeenCalledWith(accepted);
    return json({
      request_id: "job-1",
      status: "completed",
      video: { url: "https://images.higgs.ai/art.mp4" },
    });
  });
  const result = await generateSiteVideo(
    { prompt: "paper moon", aspectRatio: "16:9", duration: 5 },
    checkpoint,
  );
  expect(result).toMatchObject({
    requestId: "job-1",
    model: "bytedance/seedance-2.5/text-to-video",
    url: "https://images.higgs.ai/art.mp4",
  });
  expect(result.usd).toBeCloseTo(1.618);
  expect(fetchMock.mock.calls[0][0]).toBe(
    "https://api.higgsfield.ai/bytedance/seedance-2.5/text-to-video",
  );
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
    aspect_ratio: "16:9",
    output_format: "mp4",
    generate_audio: false,
    resolution: "720p",
    duration: 5,
  });
});
it("never forwards credentials to an untrusted status URL", async () => {
  fetchMock.mockResolvedValueOnce(json({ ...accepted, status_url: "https://evil.test/status" }));
  await expect(generateSiteVideo({ prompt: "x", aspectRatio: "1:1", duration: 5 })).rejects.toThrow(
    "status URL",
  );
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
it("reports terminal failure without submitting another paid generation or leaking response text", async () => {
  fetchMock
    .mockResolvedValueOnce(json(accepted))
    .mockResolvedValueOnce(json({ status: "failed", error: "test-secret" }));
  await expect(generateSiteVideo({ prompt: "x", aspectRatio: "1:1", duration: 5 })).rejects.toThrow(
    "job-1 failed",
  );
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
it("identifies an unfunded API account without leaking arbitrary provider response text", async () => {
  fetchMock.mockResolvedValueOnce(
    new Response(JSON.stringify({ detail: "not_enough_credits" }), { status: 403 }),
  );
  await expect(generateSiteVideo({ prompt: "x", aspectRatio: "1:1", duration: 5 })).rejects.toThrow(
    "Higgsfield API credits are empty",
  );
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("rejects a tracking URL for a different job but preserves accepted-job evidence", async () => {
  const checkpoint = vi.fn();
  fetchMock.mockResolvedValueOnce(
    json({ ...accepted, status_url: "https://platform.higgsfield.ai/requests/other/status" }),
  );
  await expect(
    generateSiteVideo({ prompt: "x", aspectRatio: "1:1", duration: 5 }, checkpoint),
  ).rejects.toThrow("status URL");
  expect(checkpoint).toHaveBeenCalledOnce();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
