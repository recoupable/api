export type PackModelTask =
  | "image"
  | "image_edit"
  | "motion"
  | "caption"
  | "still_inspection"
  | "video_inspection"
  | "analysis";
type Verification = "verified" | "unknown" | "restricted";
export type PackModelEvidence = {
  model: string;
  endpoint?: string;
  capability: Verification;
  commercial_basis: Verification;
  account_availability: Verification;
  lifecycle: "supported" | "deprecated" | "retired" | "unknown";
  valid_until: string;
  evidence: string[];
};
/** Reviewed public facts only. Unknown account access and commercial grants are never inferred. */
export function getPackModelEvidence(): {
  version: string;
  reviewed_at: string;
  tasks: Record<PackModelTask, PackModelEvidence>;
} {
  const unknown = (model: string): PackModelEvidence => ({
    model,
    capability: "unknown",
    commercial_basis: "unknown",
    account_availability: "unknown",
    lifecycle: "unknown",
    valid_until: "2026-12-18T00:00:00.000Z",
    evidence: [],
  });
  const text = (): PackModelEvidence => ({
    ...unknown("openai/gpt-4o-mini"),
    capability: "verified",
    lifecycle: "deprecated",
    evidence: [
      "https://developers.openai.com/api/docs/models/gpt-4o-mini",
      "https://developers.openai.com/api/docs/deprecations",
    ],
  });
  return {
    version: "2026-11-18.1",
    reviewed_at: "2026-11-18",
    tasks: {
      image: unknown("meta/muse-image/text-to-image"),
      image_edit: unknown("meta/muse-image/edit"),
      motion: unknown("minimax/h3-max/image-to-video"),
      caption: text(),
      still_inspection: text(),
      video_inspection: unknown("pegasus1.5"),
      analysis: {
        ...unknown("nvidia/music-flamingo-2601-hf"),
        endpoint: "https://shared-78369--music-flamingo-musicflamingo-generate.modal.run",
        capability: "verified",
        commercial_basis: "restricted",
        evidence: ["https://huggingface.co/nvidia/music-flamingo-2601-hf"],
      },
    },
  };
}
