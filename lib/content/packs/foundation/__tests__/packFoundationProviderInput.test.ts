import { expect, it, vi } from "vitest";
import { createPackProductionServices } from "../../createPackProductionServices";
import { runPackFalRequest } from "../../runPackFalRequest";
import { creditCostForImageUnits } from "@/lib/content/creditCostForImageUnits";
import { foundationFixture } from "./foundationFixture";
// Synthetic authorization isolates these unwired foundation-port tests.
vi.mock("../../getPackModelEvidence", async importOriginal => {
  const actual = await importOriginal<typeof import("../../getPackModelEvidence")>();
  const { verifiedPackModelEvidenceFixture } = await import(
    "../../__tests__/verifiedPackModelEvidenceFixture"
  );
  return {
    getPackModelEvidence: () => verifiedPackModelEvidenceFixture(actual.getPackModelEvidence()),
  };
});
vi.mock("@/lib/fal/server", () => ({ default: { queue: {} } }));
vi.mock("../../runPackFalRequest", () => ({ runPackFalRequest: vi.fn() }));
vi.mock("@/lib/supabase/release_pack_jobs/runPackCommand", () => ({ runPackCommand: vi.fn() }));
vi.mock("../../composePackMedia", () => ({ composePackMedia: vi.fn() }));
vi.mock("../../inspectPackMedia", () => ({ inspectPackMedia: vi.fn() }));
it("existing image production consumes the foundation through its real reference input, with no extra image stage", async () => {
  const snapshot = foundationFixture();
  const asset = snapshot.assets.find(a => a.kind === "video")!;
  snapshot.job.brief.reference_image_urls = [
    "https://example.com/original.png",
    "https://example.com/retained.png",
  ];
  vi.mocked(runPackFalRequest).mockResolvedValue({
    images: [{ url: "https://example.com/output.png" }],
  });
  const services = createPackProductionServices({ accountId: "owner" }, snapshot.job, asset);
  await services.generateImages("Same saved direction", 1);
  expect(runPackFalRequest).toHaveBeenCalledTimes(1);
  expect(runPackFalRequest).toHaveBeenCalledWith(
    expect.objectContaining({
      model: snapshot.job.quote!.execution_config.models.image_edit,
      input: expect.objectContaining({
        image_urls: ["https://example.com/original.png", "https://example.com/retained.png"],
        num_images: 1,
      }),
      chargeCredits: creditCostForImageUnits(1),
    }),
  );
});
