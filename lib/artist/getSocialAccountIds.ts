import { selectAccountSocials } from "@/lib/supabase/account_socials/selectAccountSocials";

const PAGE_SIZE = 100;

/** Read every account link for one social, retaining the selector's stable order. */
export async function getSocialAccountIds(socialId: string): Promise<string[]> {
  const ids = new Set<string>();
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const links = await selectAccountSocials({ socialId, offset, limit: PAGE_SIZE });
    for (const link of links) if (link.account_id) ids.add(link.account_id);
    if (links.length < PAGE_SIZE) return [...ids];
  }
}
