import type { renderExperience } from "./renderExperience";

/** Image offsets are zero-based in the existing critique call, never inferred from missing files. */
export function getCoverHiddenEvidence(
  rendered: Awaited<ReturnType<typeof renderExperience>>,
  imageOffset: number,
) {
  const images = rendered.coverHiddenImages ?? [];
  return {
    inputSha256: rendered.coverHidden?.inputSha256 ?? null,
    runnerSha256: rendered.coverHidden?.runnerSha256 ?? null,
    sourceSha256: rendered.evidence?.sourceSha256 ?? null,
    snapshotSha256: rendered.coverHidden?.snapshotSha256 ?? null,
    brandWorldSha256: rendered.coverHidden?.brandWorldSha256 ?? null,
    viewports: ["mobile", "desktop"].map(viewport => {
      const report = rendered.coverHiddenReports?.find(r => r.name === viewport);
      const index = images.findIndex(item => item.viewport === viewport);
      const captured =
        report?.status === "captured" &&
        index !== -1 &&
        !!rendered.coverHidden?.artworkUrl &&
        report.masked.length > 0 &&
        report.masked.every(item => item.src === rendered.coverHidden.artworkUrl);
      return {
        viewport,
        status: captured
          ? ("captured" as const)
          : report?.status === "missing-input"
            ? ("missing-input" as const)
            : ("unverified" as const),
        reason: captured
          ? report.reason
          : index === -1 && report?.status === "captured"
            ? "Masked screenshot is missing."
            : (report?.reason ?? "Cover-hidden evidence is missing."),
        masked: report?.masked ?? [],
        imageIndex: captured ? imageOffset + index : null,
      };
    }),
  };
}
