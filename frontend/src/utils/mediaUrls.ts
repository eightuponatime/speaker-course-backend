import { bunnyStorageCdnBaseUrl, bunnyStreamCdnBaseUrl, bunnyStreamLibraryId } from "../config/media";

const bunnyPlayerHosts = new Set(["iframe.mediadelivery.net", "player.mediadelivery.net"]);
const oldStreamHost = "vz-2f0129df-bb1.b-cdn.net";
const videoIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function bunnyHlsUrl(sourceUrl: string): string | null {
  try {
    const url = new URL(sourceUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const parts = url.pathname.split("/").filter(Boolean);
    let videoId: string | undefined;

    if (bunnyPlayerHosts.has(url.hostname.toLowerCase())) {
      if (parts.length === 3 && (parts[0] === "embed" || parts[0] === "play") && parts[1] === bunnyStreamLibraryId) {
        videoId = parts[2];
      }
    } else if (url.hostname.toLowerCase() === oldStreamHost || url.hostname.toLowerCase() === new URL(bunnyStreamCdnBaseUrl).hostname) {
      if (parts.length === 2 && parts[1] === "playlist.m3u8") videoId = parts[0];
    }

    return videoId && videoIdPattern.test(videoId)
      ? `${bunnyStreamCdnBaseUrl}/${videoId}/playlist.m3u8`
      : null;
  } catch {
    return null;
  }
}

export function normalizeStorageUrl(value: string): string {
  // Also covers URLs embedded in rich-text HTML, without changing paths or query strings.
  return value.replace(/https?:\/\/logos-voice\.b-cdn\.net(?=[/?#"'\s<]|$)/gi, bunnyStorageCdnBaseUrl);
}

// API responses include URLs in media_assets, lesson EditorJS JSON and submission attachments.
// Normalize in memory so existing database rows remain untouched and editable.
export function normalizeStorageUrls<T>(value: T): T {
  if (typeof value === "string") return normalizeStorageUrl(value) as T;
  if (Array.isArray(value)) return value.map(normalizeStorageUrls) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, normalizeStorageUrls(nested)])
    ) as T;
  }
  return value;
}
