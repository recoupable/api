import { describe, it, expect, vi, beforeEach } from "vitest";
import { attachRunEmailSubjects } from "../attachRunEmailSubjects";
import { selectEmailSubjectsByRunIds } from "@/lib/supabase/email_send_log/selectEmailSubjectsByRunIds";
import type { TaskRunWithTitle } from "../attachRunTitles";

vi.mock("@/lib/supabase/email_send_log/selectEmailSubjectsByRunIds", () => ({
  selectEmailSubjectsByRunIds: vi.fn(),
}));

const run = (id: string): TaskRunWithTitle =>
  ({
    id,
    status: "COMPLETED",
    taskIdentifier: "customer-prompt-task",
    title: null,
  }) as unknown as TaskRunWithTitle;

describe("attachRunEmailSubjects (chat#1958)", () => {
  beforeEach(() => {
    vi.mocked(selectEmailSubjectsByRunIds).mockReset();
  });

  it("annotates runs with their email subject, null when no linked send", async () => {
    vi.mocked(selectEmailSubjectsByRunIds).mockResolvedValue(
      new Map([["run_a", "Weekly LA EQUIS report"]]),
    );
    const result = await attachRunEmailSubjects([run("run_a"), run("run_b")]);
    expect(result[0].email_subject).toBe("Weekly LA EQUIS report");
    expect(result[1].email_subject).toBeNull();
  });

  it("returns [] for no runs without querying", async () => {
    expect(await attachRunEmailSubjects([])).toEqual([]);
    expect(selectEmailSubjectsByRunIds).not.toHaveBeenCalled();
  });

  // The runs list must never break on a lookup failure — same stance as
  // attachRunTitles.
  it("fails open: lookup error yields null subjects", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(selectEmailSubjectsByRunIds).mockRejectedValue(new Error("db down"));
    const result = await attachRunEmailSubjects([run("run_a")]);
    expect(result[0].email_subject).toBeNull();
  });
});
