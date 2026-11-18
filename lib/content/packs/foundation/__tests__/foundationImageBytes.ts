/** A tiny retained PNG fixture; a fresh buffer prevents cross-test mutation. */
export function foundationImageBytes(changed = false) {
  const bytes = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6ZAAAAABJRU5ErkJggg==",
    "base64",
  );
  if (changed) bytes[bytes.length - 1] ^= 1;
  return bytes;
}
