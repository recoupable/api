import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { downloadHostedYoutubeAudio } from "../downloadHostedYoutubeAudio";
const mocks = vi.hoisted(() => ({
  call: vi.fn(),
  listItems: vi.fn(),
  credits: vi.fn(),
  charge: vi.fn(),
}));
vi.mock("apify-client", () => ({
  ApifyClient: vi.fn(() => ({
    actor: () => ({ call: mocks.call }),
    dataset: () => ({ listItems: mocks.listItems }),
  })),
}));
vi.mock("@/lib/sites/production/requireCredits", () => ({ requireCredits: mocks.credits }));
vi.mock("@/lib/credits/recordCreditDeduction", () => ({ recordCreditDeduction: mocks.charge }));
const id = "EDxIXrUtMIQ";
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("APIFY_TOKEN", "test-token");
  mocks.call.mockResolvedValue({
    id: "run",
    status: "SUCCEEDED",
    defaultDatasetId: "dataset",
    usageTotalUsd: 0.02,
  });
  mocks.charge.mockResolvedValue({ success: true });
  mocks.listItems.mockResolvedValue({
    items: [
      {
        id,
        downloadedFileUrl: `https://api.apify.com/v2/key-value-stores/store/records/${id}.mp3`,
      },
    ],
  });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]))));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("caps provider spend, disables retries and charges actual reported cost", async () => {
  expect(await downloadHostedYoutubeAudio(id, "account", "site")).toEqual(Buffer.from([1, 2, 3]));
  expect(mocks.call).toHaveBeenCalledWith(
    expect.objectContaining({
      preferredFormat: "mp3",
      storeInKVStore: true,
      transcriptionAndSubtitle: "NONE",
    }),
    expect.objectContaining({ maxTotalChargeUsd: 0.5, restartOnError: false, timeout: 180 }),
  );
  expect(mocks.charge).toHaveBeenCalledWith(
    expect.objectContaining({
      accountId: "account",
      provider: "apify",
      resourceUrl: "/sites/site",
    }),
  );
  expect(vi.mocked(fetch).mock.calls[0][1]).not.toHaveProperty("headers");
});
it("rejects unexpected storage hosts before downloading", async () => {
  mocks.listItems.mockResolvedValue({
    items: [{ id, downloadedFileUrl: "https://127.0.0.1/private" }],
  });
  await expect(downloadHostedYoutubeAudio(id, "account", "site")).rejects.toThrow(
    "Unexpected hosted audio storage URL",
  );
  expect(fetch).not.toHaveBeenCalled();
});
it("does not start a paid run without credits", async () => {
  mocks.credits.mockRejectedValue(new Error("No credits"));
  await expect(downloadHostedYoutubeAudio(id, "account", "site")).rejects.toThrow("No credits");
  expect(mocks.call).not.toHaveBeenCalled();
});
it("does not continue after an ambiguous provider run", async () => {
  mocks.call.mockResolvedValue({ id: "run", status: "RUNNING", usageTotalUsd: 0 });
  await expect(downloadHostedYoutubeAudio(id, "account", "site")).rejects.toThrow(
    "requires reconciliation",
  );
  expect(mocks.listItems).not.toHaveBeenCalled();
});
