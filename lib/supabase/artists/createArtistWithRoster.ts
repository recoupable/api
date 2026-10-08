import supabase from "@/lib/supabase/serverClient";
import type { CreateArtistResult } from "@/lib/artists/createArtistInDb";
import { z } from "zod";

const artistResultSchema = z.object({
  id: z.string(),
  account_id: z.string(),
  name: z.string().nullable(),
  timestamp: z.number().min(-8640000000000000).max(8640000000000000).nullable(),
  account_socials: z.tuple([]),
  account_info: z
    .array(
      z.object({
        id: z.string(),
        account_id: z.string().nullable(),
        company_name: z.string().nullable(),
        image: z.string().nullable(),
        instruction: z.string().nullable(),
        job_title: z.string().nullable(),
        knowledges: z.json().nullable(),
        label: z.string().nullable(),
        organization: z.string().nullable(),
        role_type: z.string().nullable(),
        updated_at: z.string(),
      }),
    )
    .min(1),
});

/** Creates the legacy name-only profile and its relationships in one transaction. */
export async function createArtistWithRoster(
  name: string,
  accountId: string,
  organizationId?: string,
): Promise<CreateArtistResult> {
  const { data, error } = await supabase.rpc("create_artist_with_roster", {
    p_name: name,
    p_account_id: accountId,
    p_organization_id: organizationId ?? null,
  });
  const result = artistResultSchema.safeParse(data);
  if (error || !result.success) throw new Error("Could not create artist. Please retry.");
  const artist = result.data;
  return {
    ...artist,
    name: artist.name ?? null,
    timestamp: artist.timestamp ?? null,
    account_socials: [],
    account_info: artist.account_info.map(info => ({
      ...info,
      account_id: info.account_id ?? null,
      company_name: info.company_name ?? null,
      image: info.image ?? null,
      instruction: info.instruction ?? null,
      job_title: info.job_title ?? null,
      knowledges: info.knowledges ?? null,
      label: info.label ?? null,
      organization: info.organization ?? null,
      role_type: info.role_type ?? null,
    })),
    created_at: artist.timestamp ? new Date(artist.timestamp).toISOString() : null,
    updated_at: artist.account_info?.[0]?.updated_at ?? null,
  };
}
