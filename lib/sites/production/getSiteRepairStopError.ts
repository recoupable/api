import { SiteError } from "../SiteError";
import type { runBoundedSiteRepairs } from "./runBoundedSiteRepairs";

type StopReason = Exclude<
  Extract<Awaited<ReturnType<typeof runBoundedSiteRepairs>>, { status: "stopped" }>["reason"],
  "direction-required"
>;
const failures = {
  "attempts-exhausted": { status: 422, detail: "repair attempt limit" },
  "time-exhausted": { status: 422, detail: "repair time limit" },
  "review-blocked": { status: 402, detail: "credit limit" },
  "revision-changed": { status: 409, detail: "site revision changed" },
  cancelled: { status: 409, detail: "site deleted" },
} as const;

/** Translate coordinator stop reasons into the direct API's existing error contract. */
export function getSiteRepairStopError(reason: StopReason) {
  const { status, detail } = failures[reason];
  const advice = status === 409 ? "" : " Revise the brief or try again.";
  return new SiteError(
    status,
    `Site production stopped: ${detail}. This run did not save its candidate.${advice}`,
  );
}
