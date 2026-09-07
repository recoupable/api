/** Media types an `audio_url` may answer with besides `audio/*`. */
const ACCEPTED_CONTENT_TYPES = ["application/octet-stream"];

/**
 * Whether a content type (media type only, no parameters) is one Music
 * Flamingo can be handed: any `audio/*`, or the octet-stream that object
 * stores serve audio files under.
 *
 * @param contentType - Lower-cased media type, e.g. `audio/mpeg`.
 * @returns True when the URL is worth sending to the model.
 */
export function isAudioContentType(contentType: string): boolean {
  return contentType.startsWith("audio/") || ACCEPTED_CONTENT_TYPES.includes(contentType);
}
