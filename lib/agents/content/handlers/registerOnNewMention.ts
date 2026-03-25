import type { ContentAgentBot } from "../bot";
import { triggerCreateContent } from "@/lib/trigger/triggerCreateContent";
import { triggerPollContentRun } from "@/lib/trigger/triggerPollContentRun";
import { resolveArtistSlug } from "@/lib/content/resolveArtistSlug";
import { getArtistContentReadiness } from "@/lib/content/getArtistContentReadiness";
import { selectAccountSnapshots } from "@/lib/supabase/account_snapshots/selectAccountSnapshots";
import { isSupportedContentTemplate } from "@/lib/content/contentTemplates";
import { parseMentionArgs } from "./parseMentionArgs";

/**
 * Registers the onNewMention handler on the content agent bot.
 * Parses the mention text, validates the artist, triggers content creation,
 * and starts a polling task to report results back.
 *
 * @param bot - The content agent bot instance to register the handler on
 */
export function registerOnNewMention(bot: ContentAgentBot) {
  bot.onNewMention(async (thread, message) => {
    try {
      const { artistAccountId, template, batch, lipsync } = parseMentionArgs(message.text);

      if (!artistAccountId) {
        await thread.post(
          "Please provide an artist account ID.\n\nUsage: `@RecoupContentAgent <artist_account_id> [template] [batch=N] [lipsync]`",
        );
        return;
      }

      if (!isSupportedContentTemplate(template)) {
        await thread.post(`Unsupported template: \`${template}\`. Check available templates.`);
        return;
      }

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
          accountId: artistAccountId,
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
        accountId: artistAccountId,
        artistSlug,
        template,
        lipsync,
        captionLength: "short" as const,
        upscale: false,
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
      await triggerPollContentRun({
        runIds,
        callbackThreadId: thread.id,
      });
    } catch (error) {
      console.error("[content-agent] onNewMention error:", error);
      await thread.post("Something went wrong starting content generation. Please try again.");
    }
  });
}
