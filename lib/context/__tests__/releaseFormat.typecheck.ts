import type { ReleaseCaseProjection, ReleaseCaseReview } from "../releaseCaseTypes";
import type { ReleaseFormatObservation } from "../releaseFormatTypes";

declare const legacy: Omit<ReleaseCaseProjection, "release_format">;
const live: ReleaseCaseProjection = legacy;
const snapshot: ReleaseCaseReview["snapshot"] = legacy;
const format: ReleaseFormatObservation | undefined = live.release_format;
// @ts-expect-error Spotify observations cannot establish reissue status.
const reissue: ReleaseFormatObservation["reissue"] = "confirmed";
// @ts-expect-error Spotify observations cannot establish physical format.
const physical: ReleaseFormatObservation["physical_format"] = "vinyl";
void [snapshot, format, reissue, physical];
