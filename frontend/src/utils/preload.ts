import { useEffect, useState } from "react";

type PreloadOptions = {
  minDelayMs: number;
  timeoutMs: number;
  cacheKey?: string;
};

export function useAssetPreload(srcList: string[], options: PreloadOptions): boolean {
  const [ready, setReady] = useState(false);
  const signature = `${options.cacheKey ?? ""}|${srcList.join("|")}`;

  useEffect(() => {
    let active = true;
    setReady(srcList.length === 0);

    preloadImages(srcList, options).then(() => {
      if (active) {
        setReady(true);
      }
    });

    return () => {
      active = false;
    };
  }, [signature, options.cacheKey, options.minDelayMs, options.timeoutMs]);

  return ready;
}

export async function preloadImages(srcList: string[], options: PreloadOptions): Promise<void> {
  await Promise.race([
    Promise.allSettled(srcList.map((src) => preloadImage(src))),
    delay(options.timeoutMs)
  ]);
  await delay(options.minDelayMs);
}

async function preloadImage(src: string): Promise<void> {
  const image = new Image();

  await new Promise<void>((resolve) => {
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = src;
  });

  if ("decode" in image) {
    await image.decode().catch(() => undefined);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
