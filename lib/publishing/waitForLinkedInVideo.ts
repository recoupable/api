import { proxyLinkedIn } from "@/lib/publishing/proxyLinkedIn";

const PROCESSING_POLLS = 24;
const PROCESSING_POLL_MS = 5000;

/**
 * Poll the video until LinkedIn has processed it.
 *
 * @param connection - LinkedIn connected account id.
 * @param videoUrn - The uploaded video's URN.
 */
export async function waitForLinkedInVideo(connection: string, videoUrn: string): Promise<void> {
  for (let poll = 0; poll < PROCESSING_POLLS; poll++) {
    const { data } = await proxyLinkedIn(
      connection,
      "GET",
      `https://api.linkedin.com/rest/videos/${encodeURIComponent(videoUrn)}`,
    );
    if (data.status === "AVAILABLE") return;
    if (data.status === "PROCESSING_FAILED")
      throw new Error("LinkedIn could not process the video");
    await new Promise(resolve => setTimeout(resolve, PROCESSING_POLL_MS));
  }
  throw new Error("LinkedIn video was still processing after 2 minutes");
}
