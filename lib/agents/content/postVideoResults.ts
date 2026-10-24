import { downloadVideoBuffer } from "./downloadVideoBuffer";
import { downloadMediaBuffer } from "./downloadMediaBuffer";
import { getFilenameFromUrl } from "./getFilenameFromUrl";
import { formatContentRunFailureSummary } from "./formatContentRunFailureSummary";

interface VideoResult {
  runId: string;
  status: string;
  videoUrl?: string;
  imageUrl?: string;
  captionText?: string;
}

interface Thread {
  post: (
    message:
      | string
      | { markdown: string; files: { data: Buffer; filename: string; mimeType: string }[] },
  ) => Promise<unknown>;
}

/**
 * Downloads completed video results and optional editorial images in parallel.
 * Posts editorial images before videos, preserving result order within each group.
 * Falls back to posting the URL as text if a download fails.
 *
 * @param thread - The thread to post results to
 * @param videos - Array of completed video results
 * @param failedCount - Number of failed runs to report
 * @param timedOutCount - Number of timed-out runs to report (default 0)
 */
export async function postVideoResults(
  thread: Thread,
  videos: VideoResult[],
  failedCount: number,
  timedOutCount: number = 0,
): Promise<void> {
  const [buffers, images] = await Promise.all([
    Promise.all(videos.map(v => downloadVideoBuffer(v.videoUrl!))),
    Promise.all(videos.map(v => (v.imageUrl ? downloadMediaBuffer(v.imageUrl) : null))),
  ]);

  const supportedImages = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
  for (let i = 0; i < videos.length; i++) {
    const imageUrl = videos[i].imageUrl;
    if (!imageUrl) continue;

    const image = images[i];
    if (image?.mimeType && supportedImages.has(image.mimeType)) {
      const extension = image.mimeType === "image/jpeg" ? "jpg" : image.mimeType.split("/")[1];
      await thread.post({
        markdown: "**Editorial Image**",
        files: [
          {
            data: image.buffer,
            filename: getFilenameFromUrl(imageUrl, `editorial.${extension}`),
            mimeType: image.mimeType,
          },
        ],
      });
    } else {
      await thread.post(`**Editorial Image:** ${imageUrl}`);
    }
  }

  // Post each video sequentially (Slack ordering matters)
  for (let i = 0; i < videos.length; i++) {
    const v = videos[i];
    const videoBuffer = buffers[i];

    if (videoBuffer) {
      const filename = getFilenameFromUrl(v.videoUrl!);
      const label = videos.length > 1 ? `**Video ${i + 1}**` : "";
      const caption = v.captionText ? `> ${v.captionText}` : "";
      const markdown = [label, caption].filter(Boolean).join("\n");

      await thread.post({
        markdown: markdown || filename,
        files: [
          {
            data: videoBuffer,
            filename,
            mimeType: "video/mp4",
          },
        ],
      });
    } else {
      const label = videos.length > 1 ? `**Video ${i + 1}:** ` : "";
      const caption = v.captionText ? `\n> ${v.captionText}` : "";
      await thread.post(`${label}${v.videoUrl}${caption}`);
    }
  }

  const summary = formatContentRunFailureSummary(failedCount, timedOutCount);
  if (summary) {
    await thread.post(`_${summary}._`);
  }
}
