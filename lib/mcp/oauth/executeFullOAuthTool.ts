import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { retrieveTaskRun } from "@/lib/trigger/retrieveTaskRun";
import { selectScheduledActions } from "@/lib/supabase/scheduled_actions/selectScheduledActions";
import { retrieveVideoFunction } from "@/lib/video/retrieveVideo";
import { retrieveVideoContentFunction } from "@/lib/video/retrieveVideoContent";
import { createOAuthVideoLocator } from "./createOAuthVideoLocator";

/** Ownership-aware adapters for provider job IDs that the legacy catalog treats as global IDs. */
export async function executeFullOAuthTool(
  name: string,
  args: Record<string, unknown>,
  accountId: string,
  run: () => Promise<CallToolResult>,
): Promise<CallToolResult> {
  const result = (data: unknown): CallToolResult => ({
    content: [{ type: "text", text: JSON.stringify(data) }],
  });
  if (name === "get_task_run_status") {
    const job = await retrieveTaskRun(z.string().parse(args.runId));
    if (!job) throw new Error("Run not found");
    const payload = z
      .object({
        accountId: z.string().optional(),
        account_id: z.string().optional(),
        externalId: z.string().optional(),
      })
      .safeParse(job.payload);
    let owned =
      payload.success &&
      (payload.data.accountId === accountId || payload.data.account_id === accountId);
    if (!owned && payload.success && payload.data.externalId) {
      const tasks = await selectScheduledActions({
        id: payload.data.externalId,
        account_id: accountId,
      });
      owned = tasks.some(
        task => task.id === payload.data.externalId && task.account_id === accountId,
      );
    }
    if (!owned) throw new Error("Run access denied");
    return result({
      id: job.id,
      status: job.status,
      taskIdentifier: job.taskIdentifier,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
    });
  }
  if (name === "retrieve_sora_2_video" || name === "retrieve_sora_2_video_content") {
    const locator = z.string().parse(args.video_id);
    const video_id = createOAuthVideoLocator().verify(locator, accountId);
    const data =
      name === "retrieve_sora_2_video"
        ? await retrieveVideoFunction({ video_id })
        : await retrieveVideoContentFunction({ video_id });
    return result({
      ...data,
      ...("id" in data ? { id: locator } : {}),
      ...("video_id" in data ? { video_id: locator } : {}),
    });
  }
  if (name === "generate_sora_2_video") {
    // Validate configuration before starting a paid provider operation.
    const locators = createOAuthVideoLocator();
    const response = await run();
    const text = response.content.find(item => item.type === "text");
    if (!text || text.type !== "text") throw new Error("Video result unavailable");
    const data = z
      .object({ id: z.string(), success: z.boolean() })
      .passthrough()
      .parse(JSON.parse(text.text));
    return data.success && data.id
      ? result({ ...data, id: locators.sign(data.id, accountId) })
      : { ...response, isError: true };
  }
  return run();
}
