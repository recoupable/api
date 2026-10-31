import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateText } from "ai";
import { inspectPackMedia } from "../inspectPackMedia";
import { getPackExecutionConfiguration } from "../getPackExecutionConfiguration";
import { getPackConfigurationDigest } from "../getPackConfigurationDigest";
import { assertPackQuoteConfiguration } from "../assertPackQuoteConfiguration";
vi.mock("ai", () => ({ generateText: vi.fn() }));
vi.mock("@/lib/supabase/storage/createSignedFileUrlByKey", () => ({
  createSignedFileUrlByKey: vi.fn(async () => "https://example.com/still.png"),
}));
vi.mock("../fetchPackMedia", () => ({
  fetchPackMedia: vi.fn(async () => ({ bytes: Buffer.from("fixture") })),
}));
const input = {
  files: [{ storage_key: "owner/release-packs/still.png", content_type: "image/png", bytes: 7 }],
  prompt: "Synthetic brief",
  caption: "Synthetic caption",
  probe: {},
};
beforeEach(() => vi.resetAllMocks());
describe("pack still inspection retry policy", () => {
  it("explicitly disables SDK retries while preserving rendered-image inspection", async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: '{"passed":true,"reason":"Fixture inspected"}',
    } as never);
    await expect(inspectPackMedia(input)).resolves.toMatchObject({ passed: true });
    expect(generateText).toHaveBeenCalledOnce();
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({ maxRetries: 0, maxOutputTokens: 600, messages: expect.any(Array) }),
    );
  });
  it("propagates failed inspection without another call or inspecting the next file", async () => {
    vi.mocked(generateText).mockRejectedValue(new Error("provider result uncertain"));
    await expect(
      inspectPackMedia({ ...input, files: [...input.files, ...input.files] }),
    ).rejects.toThrow("provider result uncertain");
    expect(generateText).toHaveBeenCalledOnce();
    expect(generateText).toHaveBeenCalledWith(expect.objectContaining({ maxRetries: 0 }));
  });
  it("binds zero retries to approval and rejects the prior implicit-retry configuration", () => {
    const config = getPackExecutionConfiguration();
    expect(config.stillInspection).toMatchObject({ maxRetries: 0 });
    const old = structuredClone(config) as any;
    delete old.stillInspection.maxRetries;
    expect(() =>
      assertPackQuoteConfiguration({
        execution_config: old,
        execution_config_digest: getPackConfigurationDigest(old),
      }),
    ).toThrow(/new estimate/);
    expect(() =>
      assertPackQuoteConfiguration({
        execution_config: config,
        execution_config_digest: getPackConfigurationDigest(config),
      }),
    ).not.toThrow();
  });
});
