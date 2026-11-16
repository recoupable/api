import { beforeEach, expect, it, vi } from "vitest";
import { generateText } from "ai";
import { getPackExecutionConfiguration } from "../getPackExecutionConfiguration";
import { getPackConfigurationDigest } from "../getPackConfigurationDigest";
import { createPackProductionServices } from "../createPackProductionServices";
import { inspectPackMedia } from "../inspectPackMedia";
import { buildReleasePackQuote } from "../buildReleasePackQuote";
import { releasePackBriefSchema, releasePackDeliverablesSchema } from "../releasePackSchema";
import type { PackAsset, PackJob } from "../packTypes";

vi.mock("@/lib/const", async importOriginal => ({
  ...(await importOriginal<typeof import("@/lib/const")>()),
  LIGHTWEIGHT_MODEL: "unrelated/global-model-change",
}));
vi.mock("ai", () => ({ generateText: vi.fn() }));
vi.mock("../composePackMedia", () => ({ composePackMedia: vi.fn() }));
vi.mock("@/lib/supabase/storage/createSignedFileUrlByKey", () => ({
  createSignedFileUrlByKey: vi.fn(async () => "https://example.com/still.png"),
}));
vi.mock("../fetchPackMedia", () => ({
  fetchPackMedia: vi.fn(async () => ({ bytes: Buffer.from("fixture") })),
}));
vi.mock("@/lib/supabase/release_pack_jobs/runPackCommand", () => ({ runPackCommand: vi.fn() }));
vi.mock("@/lib/fal/server", () => ({ default: { queue: {} } }));
beforeEach(() => vi.clearAllMocks());

it("keeps Pack quote routes independent of unrelated global lightweight changes", () => {
  expect(getPackExecutionConfiguration().models).toMatchObject({
    caption: "openai/gpt-4o-mini",
    still_inspection: "openai/gpt-4o-mini",
  });
  // Existing approved configuration identity: isolation must not invalidate it.
  expect(getPackConfigurationDigest(getPackExecutionConfiguration())).toBe(
    "012c31125aaae1e336fc23bfa69c7b22b9d6b0b4de9d9f93e7c00678caeb7a24",
  );
});

it("executes captions on the Pack route recorded in the quote without SDK retries", async () => {
  const brief = releasePackBriefSchema.parse({ allow_creative_defaults: true });
  const deliverables = releasePackDeliverablesSchema.parse({});
  const quote = buildReleasePackQuote(brief, deliverables);
  const job = { id: "job", brief, deliverables, quote } as PackJob;
  vi.mocked(generateText).mockResolvedValue({ text: "Fixture caption" } as never);
  const services = createPackProductionServices({ accountId: "owner" }, job, {
    id: "asset",
    provider_state: {},
  } as PackAsset);
  await expect(services.caption("Fixture prompt")).resolves.toBe("Fixture caption");
  expect(generateText).toHaveBeenCalledWith(
    expect.objectContaining({
      model: "openai/gpt-4o-mini",
      maxRetries: 0,
    }),
  );
  expect(quote.execution_config.models.caption).toBe("openai/gpt-4o-mini");
});

it("inspects actual image bytes on the Pack QA route recorded in configuration", async () => {
  vi.mocked(generateText).mockResolvedValue({
    text: '{"passed":true,"reason":"Fixture"}',
  } as never);
  await expect(
    inspectPackMedia({
      files: [{ storage_key: "owner/still.png", content_type: "image/png", bytes: 7 }],
      prompt: "Fixture",
      caption: "Fixture",
      probe: {},
    }),
  ).resolves.toMatchObject({ passed: true });
  expect(generateText).toHaveBeenCalledWith(
    expect.objectContaining({
      model: "openai/gpt-4o-mini",
      maxRetries: 0,
      messages: expect.any(Array),
    }),
  );
  expect(getPackExecutionConfiguration().models.still_inspection).toBe("openai/gpt-4o-mini");
});
