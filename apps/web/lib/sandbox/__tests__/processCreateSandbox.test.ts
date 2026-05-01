import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Sandbox } from "@vercel/sandbox";

import { processCreateSandbox } from "../processCreateSandbox";
import { createSandboxFromSnapshot } from "@/lib/sandbox/createSandboxFromSnapshot";
import { triggerPromptSandbox } from "@/lib/trigger/triggerPromptSandbox";

vi.mock("@/lib/sandbox/createSandboxFromSnapshot", () => ({
  createSandboxFromSnapshot: vi.fn(),
}));

vi.mock("@/lib/trigger/triggerPromptSandbox", () => ({
  triggerPromptSandbox: vi.fn(),
}));

const mockSandbox = {
  sandboxId: "sbx_123",
  status: "running",
  timeout: 600000,
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
} as unknown as Sandbox;

describe("processCreateSandbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createSandboxFromSnapshot).mockResolvedValue({
      sandbox: mockSandbox,
      fromSnapshot: false,
    });
  });

  it("delegates to createSandboxFromSnapshot", async () => {
    await processCreateSandbox({ accountId: "acc_123" });

    expect(createSandboxFromSnapshot).toHaveBeenCalledWith("acc_123");
  });

  it("returns serializable response without runId when no prompt", async () => {
    const result = await processCreateSandbox({ accountId: "acc_123" });

    expect(result).toEqual({
      sandboxId: "sbx_123",
      sandboxStatus: "running",
      timeout: 600000,
      createdAt: "2024-01-01T00:00:00.000Z",
    });
    expect(triggerPromptSandbox).not.toHaveBeenCalled();
  });

  it("returns result with runId when prompt is provided", async () => {
    vi.mocked(triggerPromptSandbox).mockResolvedValue({
      id: "run_prompt123",
    });

    const result = await processCreateSandbox({
      accountId: "acc_123",
      prompt: "create a hello world index.html",
    });

    expect(result).toEqual({
      sandboxId: "sbx_123",
      sandboxStatus: "running",
      timeout: 600000,
      createdAt: "2024-01-01T00:00:00.000Z",
      runId: "run_prompt123",
    });
    expect(triggerPromptSandbox).toHaveBeenCalledWith({
      prompt: "create a hello world index.html",
      sandboxId: "sbx_123",
      accountId: "acc_123",
    });
  });

  it("throws when createSandboxFromSnapshot fails", async () => {
    vi.mocked(createSandboxFromSnapshot).mockRejectedValue(new Error("Sandbox creation failed"));

    await expect(processCreateSandbox({ accountId: "acc_123" })).rejects.toThrow(
      "Sandbox creation failed",
    );
  });

  it("returns result without runId when triggerPromptSandbox fails", async () => {
    vi.mocked(triggerPromptSandbox).mockRejectedValue(new Error("Task trigger failed"));

    const result = await processCreateSandbox({
      accountId: "acc_123",
      prompt: "say hello",
    });

    expect(result).toEqual({
      sandboxId: "sbx_123",
      sandboxStatus: "running",
      timeout: 600000,
      createdAt: "2024-01-01T00:00:00.000Z",
    });
  });
});
