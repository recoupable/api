/**
 * Downloads a file from Slack using the files.info API to get
 * url_private_download, then fetches the actual file content.
 *
 * @param fileId
 * @param token
 */
export async function downloadSlackFile(fileId: string, token: string): Promise<Buffer | null> {
  console.log(`[content-agent] Fetching file info for ${fileId}`);

  // Get url_private_download from files.info
  const infoResponse = await fetch(`https://slack.com/api/files.info?file=${fileId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!infoResponse.ok) {
    console.error(`[content-agent] files.info failed: ${infoResponse.status}`);
    return null;
  }

  const info = (await infoResponse.json()) as {
    ok: boolean;
    file?: { url_private_download?: string; url_private?: string; size?: number };
    error?: string;
  };

  if (!info.ok || !info.file) {
    console.error(`[content-agent] files.info error: ${info.error ?? "no file"}`);
    return null;
  }

  const downloadUrl = info.file.url_private_download ?? info.file.url_private;
  if (!downloadUrl) {
    console.error(`[content-agent] No download URL in files.info response`);
    return null;
  }

  console.log(`[content-agent] Downloading from: ${downloadUrl}, expectedSize=${info.file.size}`);

  // Download the actual file
  const fileResponse = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!fileResponse.ok) {
    console.error(`[content-agent] File download failed: ${fileResponse.status}`);
    return null;
  }

  const contentType = fileResponse.headers.get("content-type") ?? "";
  if (contentType.includes("text/html")) {
    console.error(`[content-agent] Got HTML instead of file content`);
    return null;
  }

  const data = Buffer.from(await fileResponse.arrayBuffer());
  console.log(`[content-agent] Downloaded: size=${data.byteLength}, contentType=${contentType}`);
  return data;
}
