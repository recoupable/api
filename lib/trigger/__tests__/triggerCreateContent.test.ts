import { beforeEach, describe, expect, it, vi } from "vitest";
import { tasks } from "@trigger.dev/sdk";
import { triggerCreateContent } from "@/lib/trigger/triggerCreateContent";
import { CREATE_CONTENT_TASK_ID } from "@/lib/const";

vi.mock("@trigger.dev/sdk", () => ({
  tasks: {
    trigger: vi.fn(),
  },
}));

describe("triggerCreateContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("triggers create-content task with the expected payload", async () => {
    const mockHandle = { id: "run_abc123" };
    vi.mocked(tasks.trigger).mockResolvedValue(mockHandle as never);

    const payload = {
      accountId: "acc_123",
      artistSlug: "gatsby-grace",
      template: "artist-caption-bedroom",
      lipsync: true,
    };
    const result = await triggerCreateContent(payload);

    expect(tasks.trigger).toHaveBeenCalledWith(CREATE_CONTENT_TASK_ID, payload);
    expect(result).toEqual(mockHandle);
  });
});
