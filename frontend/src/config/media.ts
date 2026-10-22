// These public values come from the project-root .env (or the build environment).
// Bunny API and Storage credentials are intentionally unavailable to Vite.
export const bunnyStreamLibraryId = String(import.meta.env.BUNNY_STREAM_LIBRARY_ID || "673250").trim();
export const bunnyStreamCdnBaseUrl = cdnBaseUrl(import.meta.env.BUNNY_STREAM_CDN_HOSTNAME, "video.umbra.kz");
export const bunnyStorageCdnBaseUrl = cdnBaseUrl(import.meta.env.BUNNY_STORAGE_PUBLIC_BASE_URL, "cdn.umbra.kz");

function cdnBaseUrl(value: unknown, fallbackHost: string): string {
  const configured = String(value || "").trim();
  const url = new URL(configured ? (configured.includes("://") ? configured : `https://${configured}`) : `https://${fallbackHost}`);
  return url.origin;
}
