import type { ContentAgentBot } from "../bot";
import { triggerCreateContent } from "@/lib/trigger/triggerCreateContent";
import { triggerPollContentRun } from "@/lib/trigger/triggerPollContentRun";
import { resolveArtistSlug } from "@/lib/content/resolveArtistSlug";
import { getArtistContentReadiness } from "@/lib/content/getArtistContentReadiness";
import { selectAccountSnapshots } from "@/lib/supabase/account_snapshots/selectAccountSnapshots";
import { parseContentPrompt } from "../parseContentPrompt";

/**
 * Registers the onNewMention handler on the content agent bot.
 * Parses the mention text with AI to extract content creation flags,
 * validates the artist, triggers content creation, and starts a polling
 * task to report results back.
 *
 * @param bot - The content agent bot instance to register the handler on
 */
export function registerOnNewMention(bot: ContentAgentBot) {
  bot.onNewMention(async (thread, message) => {
    try {
      const accountId = "fb678396-a68f-4294-ae50-b8cacf9ce77b";
      const artistAccountId = "1873859c-dd37-4e9a-9bac-80d3558527a9";

      // Parse the user's natural-language prompt into structured flags
      const { lipsync, batch, captionLength, upscale, template } = await parseContentPrompt(
        message.text,
      );

      // Resolve artist slug
      const artistSlug = await resolveArtistSlug(artistAccountId);
      if (!artistSlug) {
        await thread.post(
          `Artist not found for account ID \`${artistAccountId}\`. Please check the ID and try again.`,
        );
        return;
      }

      // Resolve GitHub repo
      let githubRepo: string;
      try {
        const readiness = await getArtistContentReadiness({
          accountId,
          artistAccountId,
          artistSlug,
        });
        githubRepo = readiness.githubRepo;
      } catch {
        const snapshots = await selectAccountSnapshots(artistAccountId);
        const repo = snapshots?.[0]?.github_repo;
        if (!repo) {
          await thread.post(
            `No GitHub repository found for artist \`${artistSlug}\`. Content creation requires a configured repo.`,
          );
          return;
        }
        githubRepo = repo;
      }

      // Post acknowledgment
      const batchNote = batch > 1 ? ` (${batch} videos)` : "";
      const lipsyncNote = lipsync ? " with lipsync" : "";
      await thread.post(
        `Generating content for **${artistSlug}**${batchNote}${lipsyncNote}... Template: \`${template}\`. I'll reply here when ready (~5-10 min).`,
      );

      // Trigger content creation
      const payload = {
        accountId,
        artistSlug,
        template,
        lipsync,
        captionLength,
        upscale,
        githubRepo,
      };

      const results = await Promise.allSettled(
        Array.from({ length: batch }, () => triggerCreateContent(payload)),
      );
      const runIds = results
        .filter(r => r.status === "fulfilled")
        .map(r => (r as PromiseFulfilledResult<{ id: string }>).value.id);

      if (runIds.length === 0) {
        await thread.post("Failed to trigger content creation. Please try again.");
        return;
      }

      // Set thread state
      await thread.setState({
        status: "running",
        artistAccountId,
        template,
        lipsync,
        batch,
        runIds,
      });

      // Trigger polling task
      try {
        await triggerPollContentRun({
          runIds,
          callbackThreadId: thread.id,
        });
      } catch (pollError) {
        console.error("[content-agent] triggerPollContentRun failed:", pollError);
        await thread.setState({ status: "failed" });
        await thread.post("Failed to start content polling. Please try again.");
        return;
      }
    } catch (error) {
      console.error("[content-agent] onNewMention error:", error);
      await thread.setState({ status: "failed" });
      await thread.post("Something went wrong starting content generation. Please try again.");
    }
  });
}
