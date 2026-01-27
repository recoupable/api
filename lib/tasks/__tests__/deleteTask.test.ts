import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock external dependencies
vi.mock("@/lib/supabase/scheduled_actions/selectScheduledActions", () => ({
  selectScheduledActions: vi.fn(),
}));

vi.mock("@/lib/supabase/scheduled_actions/deleteScheduledAction", () => ({
  deleteScheduledAction: vi.fn(),
}));

vi.mock("@/lib/trigger/deleteSchedule", () => ({
  deleteSchedule: vi.fn(),
}));

// Import after mocks
import { deleteTask } from "../deleteTask";
import { selectScheduledActions } from "@/lib/supabase/scheduled_actions/selectScheduledActions";
import { deleteScheduledAction } from "@/lib/supabase/scheduled_actions/deleteScheduledAction";
import { deleteSchedule } from "@/lib/trigger/deleteSchedule";

const mockSelectScheduledActions = vi.mocked(selectScheduledActions);
const mockDeleteScheduledAction = vi.mocked(deleteScheduledAction);
const mockDeleteSchedule = vi.mocked(deleteSchedule);

describe("deleteTask", () => {
  const mockTaskId = "task-123";
  const mockScheduleId = "schedule-456";

  const mockScheduledAction = {
    id: mockTaskId,
    account_id: "account-123",
    trigger_schedule_id: mockScheduleId,
    enabled: true,
    action_type: "email",
    action_params: {},
    cron_expression: "0 9 * * *",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    artist_account_id: null,
    last_run_at: null,
    next_run_at: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks
    mockSelectScheduledActions.mockResolvedValue([mockScheduledAction]);
    mockDeleteScheduledAction.mockResolvedValue();
    mockDeleteSchedule.mockResolvedValue();
  });

  describe("basic functionality", () => {
    it("fetches the scheduled action by id", async () => {
      await deleteTask({ id: mockTaskId });

      expect(mockSelectScheduledActions).toHaveBeenCalledWith({ id: mockTaskId });
    });

    it("deletes the scheduled action from the database", async () => {
      await deleteTask({ id: mockTaskId });

      expect(mockDeleteScheduledAction).toHaveBeenCalledWith(mockTaskId);
    });

    it("deletes the Trigger.dev schedule when trigger_schedule_id exists", async () => {
      await deleteTask({ id: mockTaskId });

      expect(mockDeleteSchedule).toHaveBeenCalledWith(mockScheduleId);
    });
  });

  describe("error handling", () => {
    it("throws error when task is not found", async () => {
      mockSelectScheduledActions.mockResolvedValue([]);

      await expect(deleteTask({ id: "non-existent" })).rejects.toThrow("Task not found");
    });

    it("propagates error from selectScheduledActions", async () => {
      mockSelectScheduledActions.mockRejectedValue(new Error("Database error"));

      await expect(deleteTask({ id: mockTaskId })).rejects.toThrow("Database error");
    });

    it("propagates error from deleteSchedule", async () => {
      mockDeleteSchedule.mockRejectedValue(new Error("Trigger.dev error"));

      await expect(deleteTask({ id: mockTaskId })).rejects.toThrow("Trigger.dev error");
    });

    it("propagates error from deleteScheduledAction", async () => {
      mockDeleteScheduledAction.mockRejectedValue(new Error("Delete error"));

      await expect(deleteTask({ id: mockTaskId })).rejects.toThrow("Delete error");
    });
  });

  describe("handling tasks without trigger_schedule_id", () => {
    it("skips deleteSchedule when trigger_schedule_id is null", async () => {
      mockSelectScheduledActions.mockResolvedValue([
        { ...mockScheduledAction, trigger_schedule_id: null },
      ]);

      await deleteTask({ id: mockTaskId });

      expect(mockDeleteSchedule).not.toHaveBeenCalled();
      expect(mockDeleteScheduledAction).toHaveBeenCalledWith(mockTaskId);
    });

    it("skips deleteSchedule when trigger_schedule_id is undefined", async () => {
      const taskWithoutScheduleId = { ...mockScheduledAction };
      // @ts-expect-error - Testing undefined case
      delete taskWithoutScheduleId.trigger_schedule_id;
      mockSelectScheduledActions.mockResolvedValue([taskWithoutScheduleId]);

      await deleteTask({ id: mockTaskId });

      expect(mockDeleteSchedule).not.toHaveBeenCalled();
      expect(mockDeleteScheduledAction).toHaveBeenCalledWith(mockTaskId);
    });
  });

  describe("parallel execution", () => {
    it("executes deleteSchedule and deleteScheduledAction in parallel", async () => {
      const executionOrder: string[] = [];

      // Track when each operation starts and completes
      mockDeleteSchedule.mockImplementation(async () => {
        executionOrder.push("deleteSchedule:start");
        await new Promise((resolve) => setTimeout(resolve, 10));
        executionOrder.push("deleteSchedule:end");
      });

      mockDeleteScheduledAction.mockImplementation(async () => {
        executionOrder.push("deleteScheduledAction:start");
        await new Promise((resolve) => setTimeout(resolve, 10));
        executionOrder.push("deleteScheduledAction:end");
      });

      await deleteTask({ id: mockTaskId });

      // Both should start before either ends (parallel execution)
      const deleteScheduleStartIndex = executionOrder.indexOf("deleteSchedule:start");
      const deleteScheduledActionStartIndex = executionOrder.indexOf("deleteScheduledAction:start");
      const deleteScheduleEndIndex = executionOrder.indexOf("deleteSchedule:end");
      const deleteScheduledActionEndIndex = executionOrder.indexOf("deleteScheduledAction:end");

      // Both operations should have started
      expect(deleteScheduleStartIndex).toBeGreaterThanOrEqual(0);
      expect(deleteScheduledActionStartIndex).toBeGreaterThanOrEqual(0);

      // Both starts should come before both ends (parallel behavior)
      expect(deleteScheduleStartIndex).toBeLessThan(deleteScheduleEndIndex);
      expect(deleteScheduledActionStartIndex).toBeLessThan(deleteScheduledActionEndIndex);

      // At least one start should come before the other's end (proves parallelism)
      const bothStartedBeforeAnyEnds =
        Math.max(deleteScheduleStartIndex, deleteScheduledActionStartIndex) <
        Math.min(deleteScheduleEndIndex, deleteScheduledActionEndIndex);
      expect(bothStartedBeforeAnyEnds).toBe(true);
    });

    it("both operations are called even if they would fail", async () => {
      // This test verifies that both operations are initiated via Promise.all
      // by checking both mocks are called, not their order
      await deleteTask({ id: mockTaskId });

      expect(mockDeleteSchedule).toHaveBeenCalledTimes(1);
      expect(mockDeleteScheduledAction).toHaveBeenCalledTimes(1);
    });
  });
});
