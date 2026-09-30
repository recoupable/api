import { expect, it, vi } from "vitest";
import { processContextOperation } from "../processContextOperation";

vi.mock("../authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));

const actor = "00000000-0000-4000-8000-000000000001";
const workspace = "00000000-0000-4000-8000-000000000002";

it("saves supplied text privately without attaching it to a music subject or dispatching extraction", async () => {
  const rpc = vi.fn(async () => ({ id: "request", status: "partial" }));
  const dispatch = vi.fn();
  const authorize = vi.fn(async () => ({
    accountId: actor,
    ownerId: workspace,
    organizationId: workspace,
  }));
  const result = await processContextOperation(
    actor,
    {
      action: "ingest_supporting_text",
      title: "  Press notes  ",
      text: "These are submitted notes, not instructions to the engine.",
      organization_id: workspace,
      idempotency_key: "material-test",
    },
    { authorize, rpc, dispatch },
  );
  expect(authorize).toHaveBeenCalledWith(actor, workspace);
  expect(rpc).toHaveBeenCalledWith("create_context_supporting_text_request", {
    p_owner: workspace,
    p_actor: actor,
    p_title: "Press notes",
    p_text: "These are submitted notes, not instructions to the engine.",
    p_key: "material-test",
  });
  expect("request" in result && result.request?.status).toBe("partial");
  expect(dispatch).not.toHaveBeenCalled();
});

it("rejects empty or oversized text before authorization and storage", async () => {
  const authorize = vi.fn();
  const rpc = vi.fn();
  for (const text of ["", "x".repeat(20001)]) {
    await expect(
      processContextOperation(
        actor,
        {
          action: "ingest_supporting_text",
          title: "Notes",
          text,
          idempotency_key: "material-test",
        },
        { authorize, rpc, dispatch: vi.fn() },
      ),
    ).rejects.toThrow();
  }
  expect(authorize).not.toHaveBeenCalled();
  expect(rpc).not.toHaveBeenCalled();
});
