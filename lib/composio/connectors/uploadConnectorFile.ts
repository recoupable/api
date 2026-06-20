import { getComposioClient } from "../client";
import { deriveToolkitSlug } from "./deriveToolkitSlug";

/**
 * A Composio file descriptor, ready to embed in a `file_uploadable` action
 * field (e.g. `LINKEDIN_CREATE_LINKED_IN_POST.images[]`).
 */
export interface UploadedConnectorFile {
  name: string;
  mimetype: string;
  s3key: string;
}

/**
 * Stages an image into Composio storage and returns its `{ name, mimetype, s3key }`
 * descriptor.
 *
 * Composio's SDK fetches the URL server-side, uploads the bytes to storage
 * (deduplicated by content hash), and returns a storage key that can then be
 * passed verbatim into a `file_uploadable` action parameter. The upload is
 * scoped to the action's tool/toolkit, derived from `toolSlug`.
 *
 * @param params.url - Publicly reachable image URL to stage
 * @param params.toolSlug - The action slug the file will be attached to
 *   (e.g. `LINKEDIN_CREATE_LINKED_IN_POST`)
 * @returns The Composio file descriptor
 * @throws when Composio fails to fetch or store the file (surfaced as 502 upstream)
 */
export async function uploadConnectorFile(params: {
  url: string;
  toolSlug: string;
}): Promise<UploadedConnectorFile> {
  const composio = await getComposioClient();

  const { name, mimetype, s3key } = await composio.files.upload({
    file: params.url,
    toolSlug: params.toolSlug,
    toolkitSlug: deriveToolkitSlug(params.toolSlug),
  });

  return { name, mimetype, s3key };
}
