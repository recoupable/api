import type { Tables } from "@/types/database.types";
import type { ScheduledReportRun } from "../types";

export const reportTask: Tables<"scheduled_actions"> = {
  id: "task-1",
  account_id: "acc-1",
  artist_account_id: "artist-1",
  created_at: "2026-10-01T00:00:00.000Z",
  enabled: true,
  model: null,
  prompt: "Generate a monthly report, then email it to owner@example.com.",
  schedule: "20 15 6 * *",
  title: "Monthly Catalog Report: Luh Tyler",
  trigger_schedule_id: "sched_1",
  updated_at: null,
};

export const reportRun: ScheduledReportRun = {
  runId: "run_1",
  taskId: "task-1",
  createdAt: "2026-11-06T10:20:00.000Z",
  status: "COMPLETED",
};
