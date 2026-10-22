import { bunnyHlsUrl } from "./mediaUrls";

/** Bunny's API can report a playable rendition before its HLS files reach the CDN. */
export async function isBunnyHlsReady(embedUrl: string): Promise<boolean> {
  const playlistUrl = bunnyHlsUrl(embedUrl);
  if (!playlistUrl) throw new Error("Некорректная ссылка Bunny Stream");

  const master = await fetchPlaylist(playlistUrl);
  if (master === null) return false;
  const variant = master.split(/\r?\n/).map((line) => line.trim()).find((line) => line && !line.startsWith("#") && line.includes(".m3u8"));
  if (!variant) return true;
  return (await fetchPlaylist(new URL(variant, playlistUrl).href)) !== null;
}

async function fetchPlaylist(url: string): Promise<string | null> {
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10000) });
  if (response.status === 404 || response.status >= 500) return null;
  if (response.status === 401 || response.status === 403) {
    throw new Error(`Bunny CDN отклонил доступ к видео (HTTP ${response.status}). Проверьте Referer и разрешённые домены.`);
  }
  if (!response.ok) throw new Error(`Bunny CDN вернул HTTP ${response.status} для HLS-плейлиста.`);
  const body = await response.text();
  return body.startsWith("#EXTM3U") ? body : null;
}
