import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export default defineConfig({
  envDir: fileURLToPath(new URL("../", import.meta.url)),
  envPrefix: ["VITE_", "BUNNY_STREAM_CDN_HOSTNAME", "BUNNY_STORAGE_PUBLIC_BASE_URL", "BUNNY_STREAM_LIBRARY_ID"],
  plugins: [
    react(),
    {
      name: "inline-preload-styles",
      transformIndexHtml(html) {
        // The first screen must render before the JS bundle or external CSS loads.
        const css = readFileSync(new URL("./src/styles/preload.css", import.meta.url), "utf8");
        return html.replace("<!-- preload-styles -->", `<style>${css}</style>`);
      }
    }
  ],
  server: {
    port: 5173
  },
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        hlsTest: fileURLToPath(new URL("./hls-test.html", import.meta.url))
      }
    }
  }
});
