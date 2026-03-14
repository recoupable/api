import { uploadTextToArweave } from "@/lib/arweave/uploadTextToArweave";
import { arweaveGatewayUrl } from "@/lib/arweave/arweaveGatewayUrl";
import { selectAccountInfo } from "@/lib/supabase/account_info/selectAccountInfo";
import { updateAccountInfo } from "@/lib/supabase/account_info/updateAccountInfo";
import { insertAccountInfo } from "@/lib/supabase/account_info/insertAccountInfo";
import type { Knowledge } from "./updateArtistProfile";

/**
 * Creates a knowledge base entry for an artist by uploading text to Arweave
 * and appending it to the artist's knowledges array.
 *
 * @param artistId - The artist account ID
 * @param knowledgeBaseText - The text content to add to the knowledge base
 * @returns The created knowledge entry with Arweave URL
 */
export async function createKnowledgeBase(
  artistId: string,
  knowledgeBaseText: string,
): Promise<Knowledge> {
  if (!knowledgeBaseText || knowledgeBaseText.trim().length === 0) {
    throw new Error("Knowledge base text is required");
  }

  // Upload text to Arweave
  const arweaveUrl = await uploadTextToArweave(knowledgeBaseText);
  const fetchableUrl = arweaveGatewayUrl(arweaveUrl);

  // Generate a name from the first line or a default name
  const firstLine = knowledgeBaseText.split("\n")[0].trim();
  const name = firstLine.length > 0 && firstLine.length <= 100 ? firstLine : "Knowledge Base Entry";

  // Create the knowledge entry
  const newKnowledge: Knowledge = {
    url: fetchableUrl || arweaveUrl,
    name,
    type: "text/plain",
  };

  // Get current account_info
  const accountInfo = await selectAccountInfo(artistId);

  // Get existing knowledges or initialize empty array
  const existingKnowledges: Knowledge[] = accountInfo?.knowledges
    ? (accountInfo.knowledges as unknown as Knowledge[])
    : [];

  // Append new knowledge (deduplicate by URL)
  const knowledgeMap = new Map<string, Knowledge>();
  existingKnowledges.forEach(k => {
    knowledgeMap.set(k.url, k);
  });
  knowledgeMap.set(newKnowledge.url, newKnowledge);
  const updatedKnowledges = Array.from(knowledgeMap.values());

  // Update account_info
  if (accountInfo) {
    await updateAccountInfo(artistId, {
      knowledges: updatedKnowledges as unknown as typeof accountInfo.knowledges,
    });
  } else {
    await insertAccountInfo({
      account_id: artistId,
      knowledges: updatedKnowledges as unknown as typeof accountInfo.knowledges,
    });
  }

  return newKnowledge;
}
