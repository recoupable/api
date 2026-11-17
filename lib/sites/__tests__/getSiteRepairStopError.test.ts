import { expect, it } from "vitest";
import { getSiteRepairStopError } from "../production/getSiteRepairStopError";
it.each(["cancelled", "revision-changed"] as const)(
  "reports %s without claiming external state is unchanged",
  reason => {
    const error = getSiteRepairStopError(reason);
    expect(error.status).toBe(409);
    expect(error.message).toContain(
      reason === "cancelled" ? "site deleted" : "site revision changed",
    );
    expect(error.message).toContain("This run did not save its candidate.");
    expect(error.message).not.toMatch(/unchanged|try again|Revise the brief/);
  },
);
