import { z } from "zod";
const spotifyUrl = z
  .string()
  .regex(
    /^https:\/\/open\.spotify\.com\/(?:intl-[a-z]+\/)?(track|album|playlist)\/[A-Za-z0-9]+\/?(?:\?[^<>"']*)?$/,
  )
  .transform(value => {
    const url = new URL(value);
    return `https://open.spotify.com/${url.pathname
      .replace(/^\/intl-[a-z]+/, "")
      .replace(/\/$/, "")
      .replace(/^\//, "")}`;
  });
const appleUrl = z
  .string()
  .url({ abort: true })
  .refine(value => {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "music.apple.com" &&
      !url.username &&
      !url.password &&
      !url.hash &&
      /^\/[a-z]{2}\/(album|song)\/[^/]+\/\d+$/.test(url.pathname) &&
      (!url.search || /^\?i=\d+$/.test(url.search))
    );
  }, "Use an Apple Music album or song link");
const origin = z
  .string()
  .url({ abort: true })
  .refine(value => {
    const url = new URL(value);
    return url.protocol === "https:" && url.origin === value;
  }, "Use an HTTPS origin without a path or credentials");
export const playerInputSchema = z
  .object({
    organizationId: z.string().uuid().nullable().default(null),
    artistId: z.string().uuid(),
    name: z.string().trim().min(1).max(120),
    spotifyUrl: spotifyUrl.nullable().default(null),
    appleUrl: appleUrl.nullable().default(null),
    allowedOrigins: z.array(origin).max(10).default([]),
    enabled: z.boolean().default(false),
    artwork: z
      .string()
      .url({ abort: true })
      .refine(value => {
        const url = new URL(value);
        return url.protocol === "https:" && !url.username && !url.password;
      })
      .nullable()
      .default(null),
  })
  .strict()
  .refine(value => value.spotifyUrl || value.appleUrl, "Add at least one DSP destination");
export const playerSessionSchema = z
  .object({
    playerId: z.string().uuid(),
    sessionId: z.string().uuid(),
    revision: z.number().int().positive(),
    origin,
    expiresAt: z.number().int(),
  })
  .strict();
export const listeningEventSchema = z
  .object({
    id: z.string().uuid(),
    provider: z.enum(["spotify", "apple_music"]),
    event: z.enum([
      "connected",
      "playing",
      "paused",
      "stopped",
      "track_changed",
      "skip",
      "heartbeat",
      "disconnected",
    ]),
    trackId: z
      .string()
      .regex(/^[A-Za-z0-9:_-]{1,160}$/)
      .nullable()
      .default(null),
    positionMs: z.number().int().min(0).max(86400000).default(0),
    listenedMs: z.number().int().min(0).max(30000).default(0),
  })
  .strict();
export const acquisitionSchema = z
  .object({
    source: z.string().max(100).default("direct"),
    medium: z.string().max(100).default(""),
    campaign: z.string().max(100).default(""),
    content: z.string().max(100).default(""),
  })
  .strict();
export type PlayerSession = z.infer<typeof playerSessionSchema>;
export type ListeningEvent = z.infer<typeof listeningEventSchema>;
export type ReleasePlayer = {
  id: string;
  owner_id: string;
  artist_id: string;
  name: string;
  spotify_url: string | null;
  apple_url: string | null;
  allowed_origins: string[];
  enabled: boolean;
  artwork: string | null;
  revision: number;
};
