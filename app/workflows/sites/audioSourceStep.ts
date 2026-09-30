import { acquireSiteContextAudio } from "@/lib/sites/production/acquireSiteContextAudio";
import { FatalError } from "workflow";
export async function audioSourceStep(
  ...args: [...Parameters<typeof acquireSiteContextAudio>, allowMissing?: boolean]
) {
  "use step";
  try {
    await acquireSiteContextAudio(args[0], args[1], args[2]);
    return { status: "available" as const };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "";
    if (
      args[3] &&
      [
        "Spotify preview unavailable for recording verification",
        "No matching YouTube recording found after exact and broad searches",
        "No hosted audio passed recording verification",
      ].includes(reason)
    )
      return { status: "unavailable" as const, reason };
    console.error(
      "[sites:audioSourceStep]",
      error instanceof Error ? error.message.slice(0, 1200) : "Unknown failure",
    );
    throw new FatalError(
      "Site context audioSourceStep failed. No automatic provider retry was attempted.",
    );
  }
}
