import assert from "node:assert/strict";
import { createLogger, createServer } from "vite";

const server = await createServer({
  customLogger: createLogger("silent"),
  server: { middlewareMode: true, hmr: false }
});

try {
  const { bunnyHlsUrl, normalizeStorageUrls } = await server.ssrLoadModule("/src/utils/mediaUrls.ts");
  const { bunnyStreamCdnBaseUrl, bunnyStreamLibraryId, bunnyStorageCdnBaseUrl } = await server.ssrLoadModule("/src/config/media.ts");
  const id = "519e82d9-d077-433e-a4ee-8cbd6466cae9";
  const expected = `${bunnyStreamCdnBaseUrl}/${id}/playlist.m3u8`;

  for (const source of [
    `https://iframe.mediadelivery.net/embed/${bunnyStreamLibraryId}/${id}`,
    `https://player.mediadelivery.net/embed/${bunnyStreamLibraryId}/${id}?autoplay=false`,
    `https://player.mediadelivery.net/play/${bunnyStreamLibraryId}/${id}?t=10`,
    `https://vz-2f0129df-bb1.b-cdn.net/${id}/playlist.m3u8`
  ]) {
    assert.equal(bunnyHlsUrl(source), expected);
  }
  assert.equal(bunnyHlsUrl(`https://player.mediadelivery.net/embed/999999/${id}`), null);
  assert.equal(bunnyHlsUrl("https://example.com/video.mp4"), null);

  const oldUrl = "https://logos-voice.b-cdn.net/landing/%D0%A2%D0%B5%D1%81%D1%82.pdf?download=1";
  const nextUrl = `${bunnyStorageCdnBaseUrl}/landing/%D0%A2%D0%B5%D1%81%D1%82.pdf?download=1`;
  const source = { blocks: [{ data: { url: oldUrl, html: `<a href="${oldUrl}">PDF</a>` } }] };
  const normalized = normalizeStorageUrls(source);
  assert.equal(normalized.blocks[0].data.url, nextUrl);
  assert.equal(normalized.blocks[0].data.html, `<a href="${nextUrl}">PDF</a>`);
  assert.equal(source.blocks[0].data.url, oldUrl, "normalization must not mutate loaded data");
  console.log("Media URL compatibility checks passed");
} finally {
  await server.close();
}
