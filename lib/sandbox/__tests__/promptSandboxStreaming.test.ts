import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Sandbox } from "@vercel/sandbox";

import { promptSandboxStreaming } from "../promptSandboxStreaming";

const mockGetOrCreateSandbox = vi.fn();

vi.mock("../getOrCreateSandbox", () => ({
  getOrCreateSandbox: (...args: unknown[]) => mockGetOrCreateSandbox(...args),
}));

const mockSetupFreshSandbox = vi.fn();

vi.mock("@/lib/sandbox/setup/setupFreshSandbox", () => ({
  setupFreshSandbox: (...args: unknown[]) => mockSetupFreshSandbox(...args),
}));

const mockPushSandboxToGithub = vi.fn();

vi.mock("@/lib/sandbox/setup/pushSandboxToGithub", () => ({
  pushSandboxToGithub: (...args: unknown[]) => mockPushSandboxToGithub(...args),
}));

const mockUpsertAccountSnapshot = vi.fn();

vi.mock("@/lib/supabase/account_snapshots/upsertAccountSnapshot", () => ({
  upsertAccountSnapshot: (...args: unknown[]) => mockUpsertAccountSnapshot(...args),
}));

describe("promptSandboxStreaming", () => {
  const mockRunCommand = vi.fn();
  const mockSnapshot = vi.fn();
  const mockSandbox = {
    sandboxId: "sbx_123",
    status: "running",
    runCommand: mockRunCommand,
    snapshot: mockSnapshot,
  } as unknown as Sandbox;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSnapshot.mockResolvedValue({
      snapshotId: "snap_new",
      expiresAt: new Date("2025-01-01T00:00:00.000Z"),
    });
    mockUpsertAccountSnapshot.mockResolvedValue({ data: {}, error: null });
    mockPushSandboxToGithub.mockResolvedValue(true);
  });

  /**
   *
   * @param entries
   */
  function makeFakeLogs(entries: Array<{ data: string; stream: "stdout" | "stderr" }>) {
    /**
     *
     */
    async function* fakeLogs() {
      for (const entry of entries) {
        yield entry;
      }
    }
    return {
      logs: () => fakeLogs(),
      wait: vi.fn().mockResolvedValue({ exitCode: 0 }),
    };
  }

  describe("existing sandbox (fromSnapshot=true)", () => {
    beforeEach(() => {
      mockGetOrCreateSandbox.mockResolvedValue({
        sandbox: mockSandbox,
        sandboxId: "sbx_123",
        created: false,
        fromSnapshot: true,
      });
    });

    it("yields log chunks in order and returns final result", async () => {
      mockRunCommand.mockResolvedValue(
        makeFakeLogs([
          { data: "Hello ", stream: "stdout" },
          { data: "world", stream: "stdout" },
        ]),
      );

      const chunks: Array<{ data: string; stream: "stdout" | "stderr" }> = [];
      let finalResult;

      const gen = promptSandboxStreaming({
        accountId: "acc_1",
        apiKey: "key_abc",
        prompt: "say hello",
      });

      while (true) {
        const result = await gen.next();
        if (result.done) {
          finalResult = result.value;
          break;
        }
        chunks.push(result.value as { data: string; stream: "stdout" | "stderr" });
      }

      expect(chunks).toEqual([
        { data: "Hello ", stream: "stdout" },
        { data: "world", stream: "stdout" },
      ]);

      expect(finalResult).toEqual({
        sandboxId: "sbx_123",
        stdout: "Hello world",
        stderr: "",
        exitCode: 0,
        created: false,
      });
    });

    it("does NOT run setup for snapshot-based sandboxes", async () => {
      mockRunCommand.mockResolvedValue(makeFakeLogs([{ data: "done", stream: "stdout" }]));

      const gen = promptSandboxStreaming({
        accountId: "acc_1",
        apiKey: "key_abc",
        prompt: "test",
      });

      for await (const _ of gen) {
        // consume
      }

      expect(mockSetupFreshSandbox).not.toHaveBeenCalled();
    });

    it("does NOT push to GitHub or snapshot for existing sandboxes", async () => {
      mockRunCommand.mockResolvedValue(makeFakeLogs([{ data: "done", stream: "stdout" }]));

      const gen = promptSandboxStreaming({
        accountId: "acc_1",
        apiKey: "key_abc",
        prompt: "test",
      });

      for await (const _ of gen) {
        // consume
      }

      expect(mockPushSandboxToGithub).not.toHaveBeenCalled();
      expect(mockSnapshot).not.toHaveBeenCalled();
    });

    it("accumulates stderr separately", async () => {
      mockRunCommand.mockResolvedValue(
        makeFakeLogs([
          { data: "output", stream: "stdout" },
          { data: "warn: something", stream: "stderr" },
        ]),
      );

      let finalResult;
      const gen = promptSandboxStreaming({
        accountId: "acc_1",
        apiKey: "key_abc",
        prompt: "test",
      });

      while (true) {
        const result = await gen.next();
        if (result.done) {
          finalResult = result.value;
          break;
        }
      }

      expect(finalResult).toEqual({
        sandboxId: "sbx_123",
        stdout: "output",
        stderr: "warn: something",
        exitCode: 0,
        created: false,
      });
    });

    it("uses detached mode with runCommand", async () => {
      mockRunCommand.mockResolvedValue(makeFakeLogs([{ data: "done", stream: "stdout" }]));

      const gen = promptSandboxStreaming({
        accountId: "acc_1",
        apiKey: "key_abc",
        prompt: "run",
      });

      for await (const _ of gen) {
        // consume
      }

      expect(mockRunCommand).toHaveBeenCalledWith({
        cmd: "openclaw",
        args: ["agent", "--agent", "main", "--message", "run"],
        env: { RECOUP_API_KEY: "key_abc" },
        detached: true,
      });
    });

    it("handles non-zero exit code", async () => {
      const mockCmd = {
        logs: () =>
          (async function* () {
            yield { data: "error output", stream: "stderr" as const };
          })(),
        wait: vi.fn().mockResolvedValue({ exitCode: 1 }),
      };
      mockRunCommand.mockResolvedValue(mockCmd);

      let finalResult;
      const gen = promptSandboxStreaming({
        accountId: "acc_1",
        apiKey: "key_abc",
        prompt: "bad command",
      });

      while (true) {
        const result = await gen.next();
        if (result.done) {
          finalResult = result.value;
          break;
        }
      }

      expect(finalResult).toEqual({
        sandboxId: "sbx_123",
        stdout: "",
        stderr: "error output",
        exitCode: 1,
        created: false,
      });
    });
  });

  describe("fresh sandbox (created=true, fromSnapshot=false)", () => {
    beforeEach(() => {
      mockGetOrCreateSandbox.mockResolvedValue({
        sandbox: mockSandbox,
        sandboxId: "sbx_123",
        created: true,
        fromSnapshot: false,
      });
    });

    it("runs setupFreshSandbox before the prompt", async () => {
      /**
       *
       */
      async function* fakeSetup() {
        yield { data: "[Setup] Installing...\n", stream: "stderr" as const };
        yield { data: "[Setup] Done!\n", stream: "stderr" as const };
        return "https://github.com/recoupable/repo";
      }
      mockSetupFreshSandbox.mockReturnValue(fakeSetup());

      mockRunCommand.mockResolvedValue(makeFakeLogs([{ data: "prompt result", stream: "stdout" }]));

      const chunks: Array<{ data: string; stream: string }> = [];
      const gen = promptSandboxStreaming({
        accountId: "acc_1",
        apiKey: "key_abc",
        prompt: "test",
      });

      while (true) {
        const result = await gen.next();
        if (result.done) break;
        chunks.push(result.value as { data: string; stream: string });
      }

      // Setup messages come first, then prompt output
      expect(chunks[0].data).toContain("[Setup]");
      expect(chunks[chunks.length - 1].data).toBe("prompt result");
    });

    it("pushes to GitHub and snapshots after prompt completes", async () => {
      /**
       *
       */
      async function* fakeSetup() {
        yield { data: "[Setup] Done!\n", stream: "stderr" as const };
        return "https://github.com/recoupable/repo";
      }
      mockSetupFreshSandbox.mockReturnValue(fakeSetup());

      mockRunCommand.mockResolvedValue(makeFakeLogs([{ data: "done", stream: "stdout" }]));

      const gen = promptSandboxStreaming({
        accountId: "acc_1",
        apiKey: "key_abc",
        prompt: "test",
      });

      for await (const _ of gen) {
        // consume
      }

      expect(mockPushSandboxToGithub).toHaveBeenCalledWith(
        mockSandbox,
        expect.objectContaining({ log: expect.any(Function) }),
      );
      expect(mockSnapshot).toHaveBeenCalled();
      expect(mockUpsertAccountSnapshot).toHaveBeenCalledWith(
        expect.objectContaining({
          account_id: "acc_1",
          snapshot_id: "snap_new",
          expires_at: "2025-01-01T00:00:00.000Z",
          github_repo: "https://github.com/recoupable/repo",
        }),
      );
    });

    it("still returns final result with created=true", async () => {
      /**
       *
       */
      async function* fakeSetup() {
        yield { data: "[Setup] Done!\n", stream: "stderr" as const };
        return undefined;
      }
      mockSetupFreshSandbox.mockReturnValue(fakeSetup());

      mockRunCommand.mockResolvedValue(makeFakeLogs([{ data: "output", stream: "stdout" }]));

      let finalResult;
      const gen = promptSandboxStreaming({
        accountId: "acc_1",
        apiKey: "key_abc",
        prompt: "test",
      });

      while (true) {
        const result = await gen.next();
        if (result.done) {
          finalResult = result.value;
          break;
        }
      }

      expect(finalResult!.created).toBe(true);
      expect(finalResult!.sandboxId).toBe("sbx_123");
    });

    it("snapshots even when push fails", async () => {
      /**
       *
       */
      async function* fakeSetup() {
        yield { data: "[Setup] Done!\n", stream: "stderr" as const };
        return "https://github.com/recoupable/repo";
      }
      mockSetupFreshSandbox.mockReturnValue(fakeSetup());
      mockPushSandboxToGithub.mockResolvedValue(false);

      mockRunCommand.mockResolvedValue(makeFakeLogs([{ data: "done", stream: "stdout" }]));

      const gen = promptSandboxStreaming({
        accountId: "acc_1",
        apiKey: "key_abc",
        prompt: "test",
      });

      for await (const _ of gen) {
        // consume
      }

      // Should still snapshot even if push failed
      expect(mockSnapshot).toHaveBeenCalled();
      expect(mockUpsertAccountSnapshot).toHaveBeenCalled();
    });
  });

  describe("created from snapshot (created=true, fromSnapshot=true)", () => {
    it("does NOT run setup", async () => {
      mockGetOrCreateSandbox.mockResolvedValue({
        sandbox: mockSandbox,
        sandboxId: "sbx_snap",
        created: true,
        fromSnapshot: true,
      });

      mockRunCommand.mockResolvedValue(makeFakeLogs([{ data: "done", stream: "stdout" }]));

      const gen = promptSandboxStreaming({
        accountId: "acc_1",
        apiKey: "key_abc",
        prompt: "test",
      });

      for await (const _ of gen) {
        // consume
      }

      expect(mockSetupFreshSandbox).not.toHaveBeenCalled();
      expect(mockPushSandboxToGithub).not.toHaveBeenCalled();
    });
  });
});
