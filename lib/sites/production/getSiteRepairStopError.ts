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
  "revision-changed": { status: 409, detail: "site revision or availability changed" },
  cancelled: { status: 409, detail: "site revision or availability changed" },
} as const;

/** Translate coordinator stop reasons into the direct API's existing error contract. */
export function getSiteRepairStopError(reason: StopReason) {
  const { status, detail } = failures[reason];
  return new SiteError(
    status,
    `Site production stopped: ${detail}. Your saved draft and published version are unchanged. Revise the brief or try again.`,
  );
}
