import { createHash } from "node:crypto";
import supabase from "@/lib/supabase/serverClient";
/** Verify the bytes in private storage, including the exact WAV format used successfully by Music Flamingo. */
export async function getContextAudioFileMetadata(key: string) {
  const { data, error } = await supabase.storage.from("user-files").download(key);
  if (error || !data) throw new Error("Saved context audio is unavailable");
  if (data.size > 40_000_000) throw new Error("Context audio exceeds the supported size");
  const buffer = Buffer.from(await data.arrayBuffer());
  if (
    buffer.toString("ascii", 0, 4) !== "RIFF" ||
    buffer.toString("ascii", 8, 12) !== "WAVE" ||
    buffer.readUInt32LE(4) + 8 !== buffer.length
  )
    throw new Error("Invalid WAV container");
  let format = false;
  let audioBytes = 0;
  for (let offset = 12; offset + 8 <= buffer.length; ) {
    const size = buffer.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (start + size > buffer.length) throw new Error("Truncated WAV chunk");
    const kind = buffer.toString("ascii", offset, offset + 4);
    if (kind === "fmt ") {
      if (
        size < 16 ||
        buffer.readUInt16LE(start) !== 1 ||
        buffer.readUInt16LE(start + 2) !== 1 ||
        buffer.readUInt32LE(start + 4) !== 16000 ||
        buffer.readUInt32LE(start + 8) !== 32000 ||
        buffer.readUInt16LE(start + 12) !== 2 ||
        buffer.readUInt16LE(start + 14) !== 16
      )
        throw new Error("Expected mono 16 kHz PCM16 WAV");
      format = true;
    }
    if (kind === "data") audioBytes += size;
    offset = start + size + (size % 2);
  }
  if (!format || !audioBytes || audioBytes % 2) throw new Error("Missing or invalid WAV audio");
  return {
    sha256: createHash("sha256").update(buffer).digest("hex"),
    durationSeconds: audioBytes / 32000,
    bytes: buffer.length,
  };
}
