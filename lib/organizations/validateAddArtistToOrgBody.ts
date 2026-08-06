import { z } from "zod";

export const addArtistToOrgBodySchema = z.object({
  artistId: z.string({ message: "artistId is required" }).uuid("artistId must be a valid UUID"),
  organizationId: z
    .string({ message: "organizationId is required" })
    .uuid("organizationId must be a valid UUID"),
});

export type AddArtistToOrgBody = z.infer<typeof addArtistToOrgBodySchema>;
