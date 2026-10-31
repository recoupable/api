import { publishInstagram } from "@/lib/publishing/publish/publishInstagram";
import { publishLinkedIn } from "@/lib/publishing/publish/publishLinkedIn";
import { publishX } from "@/lib/publishing/publish/publishX";
import { publishYouTube } from "@/lib/publishing/publish/publishYouTube";
import type { PostPlatform } from "@/lib/publishing/const";
import type { PublishInput, PublishResult } from "@/lib/publishing/publish/types";

const PUBLISHERS: Record<PostPlatform, (input: PublishInput) => Promise<PublishResult>> = {
  instagram: publishInstagram,
  x: publishX,
  linkedin: publishLinkedIn,
  youtube: publishYouTube,
};

/**
 * Run the post's platform sequence.
 *
 * @param input - Connection and post row.
 * @returns The live URL and text check.
 */
export async function publishToPlatform(input: PublishInput): Promise<PublishResult> {
  const publish = PUBLISHERS[input.post.platform as PostPlatform];
  if (!publish) throw new Error(`Unsupported platform: ${input.post.platform}`);
  return publish(input);
}
