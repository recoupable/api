import { downloadVideoBuffer } from "./downloadVideoBuffer";
import { getFilenameFromUrl } from "./getFilenameFromUrl";

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
 * Downloads completed videos and static images in parallel and posts each to the thread.
 * Falls back to posting the URL as text if a download fails.
 *
 * @param thread - The thread to post results to
 * @param videos - Array of completed video results (may also contain imageUrl)
 * @param failedCount - Number of failed runs to report
 */
export async function postVideoResults(
  thread: Thread,
  videos: VideoResult[],
  failedCount: number,
): Promise<void> {
  // Collect all URLs to download in parallel
  const imageUrls = videos.map(v => v.imageUrl).filter(Boolean) as string[];
  const videoUrls = videos.map(v => v.videoUrl!);

  const [imageBuffers, videoBuffers] = await Promise.all([
    Promise.all(imageUrls.map(url => downloadVideoBuffer(url))),
    Promise.all(videoUrls.map(url => downloadVideoBuffer(url))),
  ]);

  // Post static images first (one per result that has imageUrl)
  let imgIdx = 0;
  for (const v of videos) {
    if (!v.imageUrl) continue;
    const imageBuffer = imageBuffers[imgIdx++];

    if (imageBuffer) {
      const filename = getFilenameFromUrl(v.imageUrl);
      await thread.post({
        markdown: "**Editorial Image**",
        files: [
          {
            data: imageBuffer,
            filename,
            mimeType: "image/png",
          },
        ],
      });
    } else {
      await thread.post(`**Editorial Image:** ${v.imageUrl}`);
    }
  }

  // Post each video sequentially (Slack ordering matters)
  for (let i = 0; i < videos.length; i++) {
    const v = videos[i];
    const videoBuffer = videoBuffers[i];

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

  if (failedCount > 0) {
    await thread.post(`_${failedCount} run(s) failed._`);
  }
}
