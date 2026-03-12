import { describe, it, expect, vi, beforeEach } from "vitest";

// Import after mocks
import { createTask } from "../createTask";
import { insertScheduledAction } from "@/lib/supabase/scheduled_actions/insertScheduledAction";
import { updateScheduledAction } from "@/lib/supabase/scheduled_actions/updateScheduledAction";
import { deleteScheduledAction } from "@/lib/supabase/scheduled_actions/deleteScheduledAction";
import { createSchedule } from "@/lib/trigger/createSchedule";

// Mock external dependencies
vi.mock("@/lib/supabase/scheduled_actions/insertScheduledAction", () => ({
  insertScheduledAction: vi.fn(),
}));

vi.mock("@/lib/supabase/scheduled_actions/updateScheduledAction", () => ({
  updateScheduledAction: vi.fn(),
}));

vi.mock("@/lib/supabase/scheduled_actions/deleteScheduledAction", () => ({
  deleteScheduledAction: vi.fn(),
}));

vi.mock("@/lib/trigger/createSchedule", () => ({
  createSchedule: vi.fn(),
}));

const mockInsert = vi.mocked(insertScheduledAction);
const mockUpdate = vi.mocked(updateScheduledAction);
const mockDelete = vi.mocked(deleteScheduledAction);
const mockCreateSchedule = vi.mocked(createSchedule);

describe("createTask", () => {
  const validInput = {
    title: "Test Task",
    prompt: "Do something",
    schedule: "0 21 * * 0",
    account_id: "account-123",
    artist_account_id: "artist-456",
  };

  const mockCreatedTask = {
    id: "task-789",
    title: "Test Task",
    prompt: "Do something",
    schedule: "0 21 * * 0",
    account_id: "account-123",
    artist_account_id: "artist-456",
    enabled: true,
    last_run: null,
    next_run: null,
    trigger_schedule_id: null,
    model: null,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockResolvedValue([mockCreatedTask]);
    mockCreateSchedule.mockResolvedValue({ id: "trigger-schedule-123" });
    mockUpdate.mockResolvedValue({
      ...mockCreatedTask,
      trigger_schedule_id: "trigger-schedule-123",
    });
    mockDelete.mockResolvedValue();
  });

  describe("successful creation", () => {
    it("inserts the task, creates trigger schedule, and updates with schedule id", async () => {
      const result = await createTask(validInput);

      expect(mockInsert).toHaveBeenCalledWith(validInput);
      expect(mockCreateSchedule).toHaveBeenCalledWith({
        cron: "0 21 * * 0",
        deduplicationKey: "task-789",
        externalId: "task-789",
      });
      expect(mockUpdate).toHaveBeenCalledWith({
        id: "task-789",
        trigger_schedule_id: "trigger-schedule-123",
      });
      expect(result.trigger_schedule_id).toBe("trigger-schedule-123");
    });
  });

  describe("rollback on Trigger.dev failure", () => {
    it("deletes the DB record when createSchedule throws", async () => {
      mockCreateSchedule.mockRejectedValue(new Error("Invalid cron"));

      await expect(createTask(validInput)).rejects.toThrow(
        "Failed to create Trigger.dev schedule: Invalid cron",
      );

      expect(mockDelete).toHaveBeenCalledWith("task-789");
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("deletes the DB record when createSchedule returns no id", async () => {
      mockCreateSchedule.mockResolvedValue({ id: "" });

      await expect(createTask(validInput)).rejects.toThrow(
        "Failed to create Trigger.dev schedule: missing schedule id",
      );

      expect(mockDelete).toHaveBeenCalledWith("task-789");
    });

    it("still throws even if rollback delete fails", async () => {
      mockCreateSchedule.mockRejectedValue(new Error("Invalid cron"));
      mockDelete.mockRejectedValue(new Error("Delete failed"));

      await expect(createTask(validInput)).rejects.toThrow(
        "Failed to create Trigger.dev schedule: Invalid cron",
      );
    });
  });

  describe("cron validation", () => {
    it("rejects invalid cron expressions like double asterisks", async () => {
      const invalidInput = { ...validInput, schedule: "0 21 ** ** 0" };

      await expect(createTask(invalidInput)).rejects.toThrow();
      expect(mockInsert).not.toHaveBeenCalled();
    });
  });
});
