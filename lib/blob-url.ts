/**
 * Validates that a client-supplied URL actually points at this project's own
 * Vercel Blob store before the server fetches it. Without this, an
 * authenticated user could pass any URL — an internal service address, a
 * cloud metadata endpoint, anything the deployment can reach — and the
 * server would fetch it and (via lib/materials/ingest.ts) return the
 * extracted text back in an AI reply or material record: SSRF with response
 * reflection, not just a blind fetch.
 *
 * Vercel Blob's public store URLs are always
 * `https://<store-id>.public.blob.vercel-storage.com/...`.
 */
export function isTrustedBlobUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return parsed.protocol === 'https:' && /^[a-z0-9]+\.public\.blob\.vercel-storage\.com$/i.test(parsed.hostname);
}
