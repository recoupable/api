import type { ContentAgentBot } from "../bot";
import type { ContentAgentThreadState } from "../types";
import { parseContentIntent } from "../parseContentIntent";
import { parseEditOperations } from "../parseEditOperations";
import { parseContentPrompt } from "../parseContentPrompt";
import { extractMessageAttachments } from "../extractMessageAttachments";
import { triggerEditContent } from "@/lib/trigger/triggerEditContent";
import { triggerCreateContent } from "@/lib/trigger/triggerCreateContent";
import { triggerPollContentRun } from "@/lib/trigger/triggerPollContentRun";
import { resolveArtistSlug } from "@/lib/content/resolveArtistSlug";
import { getArtistContentReadiness } from "@/lib/content/getArtistContentReadiness";
import { selectAccountSnapshots } from "@/lib/supabase/account_snapshots/selectAccountSnapshots";
import { loadTemplate } from "@/lib/content/templates";
import { buildTaskCard } from "@/lib/agents/buildTaskCard";

/** Minimal thread interface used by helper functions. */
interface ContentThread {
  id: string;
  post: (msg: unknown) => Promise<unknown>;
  setState: (s: Partial<ContentAgentThreadState>) => Promise<void>;
}

/** Minimal message shape compatible with extractMessageAttachments. */
interface ContentMessage {
  text: string;
  attachments?: Array<{
    type: "image" | "file" | "video" | "audio";
    mimeType?: string;
    name?: string;
    url?: string;
    data?: Buffer | Blob;
    fetchData?: () => Promise<Buffer>;
  }>;
}

/**
 * Registers the onSubscribedMessage handler for the content agent.
 * Handles replies in active threads — determines whether to edit
 * existing content or generate new content based on AI classification.
 *
 * @param bot - The content agent bot instance to register the handler on
 */
export function registerOnSubscribedMessage(bot: ContentAgentBot) {
  bot.onSubscribedMessage(async (thread, message) => {
    // Guard against bot-authored messages to prevent echo loops
    if (message.author.isBot || message.author.isMe) return;

    const state = await thread.state;

    if (state?.status === "running") {
      await thread.post("Still generating your content. I'll reply here when it's ready.");
      return;
    }

    if (state?.status === "completed") {
      await handleCompletedThreadReply(thread, message, state);
      return;
    }

    // For failed/timeout states, suggest starting a new thread
    if (state?.status === "failed" || state?.status === "timeout") {
      await thread.post(
        "The previous generation failed or timed out. Please start a new thread by mentioning me again.",
      );
    }
  });
}

/**
 * Handles a reply in a thread where content was previously generated.
 * Classifies intent as edit or generate and dispatches accordingly.
 *
 * @param thread - The active thread to post to and manage state
 * @param message - The incoming user message
 * @param message.text - The raw text of the user's message
 * @param state - Current thread state with previous generation details
 */
async function handleCompletedThreadReply(
  thread: ContentThread,
  message: ContentMessage,
  state: ContentAgentThreadState,
) {
  try {
    const threadContext = buildThreadContext(state);
    const intent = await parseContentIntent(message.text, threadContext);

    if (intent.action === "edit") {
      await handleEditFlow(thread, message.text, state);
    } else {
      await handleGenerateFlow(thread, message, state);
    }
  } catch (error) {
    console.error("[content-agent] handleCompletedThreadReply error:", error);
    await thread.post("Something went wrong processing your request. Please try again.");
  }
}

/**
 * Builds a human-readable summary of the thread's previous generation
 * for the intent classifier.
 *
 * @param state - The thread state to summarise.
 * @returns A one-line context string.
 */
function buildThreadContext(state: ContentAgentThreadState): string {
  const parts = [
    `Previously generated ${state.batch} video(s)`,
    `template: ${state.template}`,
    `lipsync: ${state.lipsync}`,
  ];
  if (state.videoUrls?.length) {
    parts.push(`${state.videoUrls.length} video(s) available for editing`);
  }
  return parts.join(", ");
}

/**
 * Handles the edit flow: parses edit operations, triggers ffmpeg-edit,
 * and starts polling for results.
 *
 * @param thread - The active thread to post to and manage state
 * @param messageText - The user's edit instruction text
 * @param state - Current thread state with video URLs
 */
async function handleEditFlow(
  thread: ContentThread,
  messageText: string,
  state: ContentAgentThreadState,
) {
  const videoUrl = state.videoUrls?.[0];
  if (!videoUrl) {
    await thread.post(
      "No video URL found from the previous generation. Please start a new thread to generate content first.",
    );
    return;
  }

  const editResult = await parseEditOperations(messageText);
  if (!editResult) {
    await thread.post(
      "Could not parse edit instructions. Try something like: trim to 10 seconds, crop to square, or add text overlay.",
    );
    return;
  }

  // Resolve operations from template if needed
  let operations = editResult.operations;
  if (editResult.template && (!operations || operations.length === 0)) {
    const template = loadTemplate(editResult.template);
    if (template?.edit.operations) {
      operations = template.edit.operations as typeof operations;
    }
  }

  if (!operations || operations.length === 0) {
    await thread.post(
      "No edit operations could be determined from your message. Try: trim, crop, resize, or add text overlay.",
    );
    return;
  }

  const accountId = "fb678396-a68f-4294-ae50-b8cacf9ce77b";

  const handle = await triggerEditContent({
    accountId,
    video_url: videoUrl,
    operations,
  });

  const card = buildTaskCard(
    "Content Edit Started",
    `Editing video with ${operations.length} operation(s)...\n\nI'll reply here when ready.`,
    handle.id,
  );
  await thread.post({ card });

  await thread.setState({ status: "running", runIds: [handle.id] });

  try {
    await triggerPollContentRun({
      runIds: [handle.id],
      callbackThreadId: thread.id,
    });
  } catch (pollError) {
    console.error("[content-agent] triggerPollContentRun (edit) failed:", pollError);
    await thread.setState({ status: "failed" });
    await thread.post("Failed to start edit polling. Please try again.");
  }
}

/**
 * Handles the generate-new flow: parses content prompt flags,
 * triggers content creation, and starts polling.
 *
 * @param thread - The active thread to post to and manage state
 * @param message - The incoming user message with potential attachments
 * @param message.text - The raw text of the user's message
 * @param state - Current thread state with artist details
 */
async function handleGenerateFlow(
  thread: ContentThread,
  message: ContentMessage,
  state: ContentAgentThreadState,
) {
  const accountId = "fb678396-a68f-4294-ae50-b8cacf9ce77b";
  const artistAccountId = state.artistAccountId;

  const { lipsync, batch, captionLength, upscale, template, songs } = await parseContentPrompt(
    message.text,
  );

  const { songUrl, imageUrls } = await extractMessageAttachments(message);

  const artistSlug = await resolveArtistSlug(artistAccountId);
  if (!artistSlug) {
    await thread.post(`Artist not found for account ID \`${artistAccountId}\`.`);
    return;
  }

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

  const allSongs = [...(songs ?? []), ...(songUrl ? [songUrl] : [])];

  const payload = {
    accountId,
    artistSlug,
    template,
    lipsync,
    captionLength,
    upscale,
    githubRepo,
    ...(allSongs.length > 0 && { songs: allSongs }),
    ...(imageUrls.length > 0 && { images: imageUrls }),
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

  const details = [
    `- Artist: *${artistSlug}*`,
    `- Template: ${template}`,
    `- Videos: ${batch}`,
    `- Lipsync: ${lipsync ? "yes" : "no"}`,
  ];
  if (songs && songs.length > 0) details.push(`- Songs: ${songs.join(", ")}`);
  if (songUrl) details.push("- Audio: attached file");
  if (imageUrls.length > 0) details.push(`- Images: ${imageUrls.length} attached`);

  const card = buildTaskCard(
    "Content Generation Started",
    `Generating content for *${artistSlug}*...\n${details.join("\n")}\n\nI'll reply here when ready (~5-10 min).`,
    runIds[0],
  );
  await thread.post({ card });

  await thread.setState({
    status: "running",
    artistAccountId,
    template,
    lipsync,
    batch,
    runIds,
  });

  try {
    await triggerPollContentRun({
      runIds,
      callbackThreadId: thread.id,
    });
  } catch (pollError) {
    console.error("[content-agent] triggerPollContentRun (generate) failed:", pollError);
    await thread.setState({ status: "failed" });
    await thread.post("Failed to start content polling. Please try again.");
  }
}
