import { expect, it, vi } from "vitest";
import { preparePackStep } from "@/app/workflows/packs/preparePackStep";
const mocks = vi.hoisted(() => ({ command: vi.fn(), prepare: vi.fn() }));
vi.mock("workflow", () => ({ getWorkflowMetadata: () => ({ workflowRunId: "original-run" }) }));
vi.mock("@/lib/supabase/release_pack_jobs/runPackCommand", () => ({
  runPackCommand: mocks.command,
}));
vi.mock("@/lib/content/packs/preparePackProduction", () => ({
  preparePackProduction: mocks.prepare,
}));
it("refuses rotation between run acknowledgement and fresh read before preparation", async () => {
  const original = {
    expected_revision: 1,
    execution_id: "00000000-0000-4000-8000-000000000001",
    execution_version: 1,
  };
  mocks.command.mockResolvedValueOnce({}).mockResolvedValueOnce({
    job: {
      protocol: 2,
      revision: 1,
      execution_id: "00000000-0000-4000-8000-000000000002",
      execution_version: 2,
      workflow_run_id: "new-run",
      status: "running",
    },
    assets: [],
  });
  await expect(
    preparePackStep({ accountId: "owner", packProtocol: 2 }, "job", original),
  ).rejects.toThrow("Pack execution changed");
  expect(mocks.prepare).not.toHaveBeenCalled();
  expect(mocks.command).toHaveBeenNthCalledWith(
    1,
    { accountId: "owner", packProtocol: 2 },
    "run",
    "job",
    { ...original, workflow_run_id: "original-run" },
  );
});
