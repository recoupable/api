import { downloadVideoBuffer } from "./downloadVideoBuffer";
import { getFilenameFromUrl } from "./getFilenameFromUrl";

interface VideoResult {
  runId: string;
  status: string;
  videoUrl?: string;
  captionText?: string;
}

interface Thread {
  post: (message: string | { markdown: string; files: { data: Buffer; filename: string; mimeType: string }[] }) => Promise<void>;
}

/**
 * Downloads completed videos in parallel and posts each to the thread.
 * Falls back to posting the URL as text if a download fails.
 *
 * @param thread - The thread to post results to
 * @param videos - Array of completed video results
 * @param failedCount - Number of failed runs to report
 */
export async function postVideoResults(
  thread: Thread,
  videos: VideoResult[],
  failedCount: number,
): Promise<void> {
  // Download all videos in parallel
  const buffers = await Promise.all(
    videos.map(v => downloadVideoBuffer(v.videoUrl!)),
  );

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

  if (failedCount > 0) {
    await thread.post(`_${failedCount} run(s) failed._`);
  }
}
