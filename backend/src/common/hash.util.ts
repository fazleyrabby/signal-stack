import { createHash } from 'crypto';

/**
 * Normalize a URL by removing tracking query params (utm_*, ref, etc.)
 */
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url.trim().toLowerCase());
    const paramsToRemove: string[] = [];

    parsed.searchParams.forEach((_, key) => {
      if (
        key.startsWith('utm_') ||
        key === 'ref' ||
        key === 'source' ||
        key === 'fbclid' ||
        key === 'gclid' ||
        key === 'mc_cid' ||
        key === 'mc_eid'
      ) {
        paramsToRemove.push(key);
      }
    });

    paramsToRemove.forEach((key) => parsed.searchParams.delete(key));

    return parsed.toString();
  } catch {
    return url.trim().toLowerCase();
  }
}

/**
 * Normalize title: lowercase, trim, collapse whitespace
 */
function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Generate a SHA-256 hash for deduplication
 */
export function generateHash(title: string, url: string): string {
  const normalizedTitle = normalizeTitle(title);
  const normalizedUrl = normalizeUrl(url);

  return createHash('sha256')
    .update(`${normalizedTitle}|${normalizedUrl}`)
    .digest('hex');
}
