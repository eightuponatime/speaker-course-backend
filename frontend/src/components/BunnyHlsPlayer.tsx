import { useEffect, useRef, useState } from "react";
import type Hls from "hls.js";

type BunnyHlsPlayerProps = {
  playlistUrl: string;
  title: string;
  resumeAt?: number;
  lazy?: boolean;
  onProgress?: (seconds: number, duration: number) => void;
};

export function BunnyHlsPlayer({ playlistUrl, title, resumeAt = 0, lazy = false, onProgress }: BunnyHlsPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef(onProgress);
  const missingPlaylistRetries = useRef(0);
  const [visible, setVisible] = useState(!lazy);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");
  const [waitingForCdn, setWaitingForCdn] = useState(false);
  progressRef.current = onProgress;

  useEffect(() => {
    missingPlaylistRetries.current = 0;
    setWaitingForCdn(false);
  }, [playlistUrl]);

  useEffect(() => {
    if (!lazy || !containerRef.current || !window.IntersectionObserver) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: "300px" });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [lazy]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !visible) return;

    let disposed = false;
    let player: Hls | undefined;
    let retryTimer: number | undefined;
    setError("");

    async function start() {
      try {
        const { default: HlsPlayer } = await import("hls.js");
        if (disposed) return;

        if (HlsPlayer.isSupported()) {
          player = new HlsPlayer();
          player.on(HlsPlayer.Events.ERROR, (_event, data) => {
            if (!data.fatal || disposed) return;
            if (data.type !== HlsPlayer.ErrorTypes.NETWORK_ERROR) {
              setError(data.type === HlsPlayer.ErrorTypes.MEDIA_ERROR
                ? "Не удалось декодировать видео. Попробуйте перезагрузить плеер."
                : "Ошибка видеоплеера. Попробуйте перезагрузить плеер.");
              return;
            }
            const status = data.response?.code;
            const resource = data.context?.url?.includes(".m3u8") || /manifest|level/i.test(data.details)
              ? "плейлиста"
              : "видеосегмента";
            if (status === 404 && resource === "плейлиста" && missingPlaylistRetries.current < 24) {
              if (retryTimer === undefined) {
                missingPlaylistRetries.current += 1;
                setWaitingForCdn(true);
                retryTimer = window.setTimeout(() => setAttempt((current) => current + 1), 5000);
              }
              return;
            }
            setWaitingForCdn(false);
            setError(`Не удалось загрузить ${resource}${status ? ` (HTTP ${status})` : ""}. Проверьте подключение и доступ к видео.`);
          });
          player.loadSource(playlistUrl);
          player.attachMedia(video!);
        } else if (video!.canPlayType("application/vnd.apple.mpegurl")) {
          video!.src = playlistUrl;
        } else {
          setError("Этот браузер не поддерживает HLS-видео.");
        }
      } catch {
        if (disposed) return;
        if (video!.canPlayType("application/vnd.apple.mpegurl")) {
          video!.src = playlistUrl;
        } else {
          setError("Не удалось запустить видеоплеер.");
        }
      }
    }

    void start();
    return () => {
      disposed = true;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      progressRef.current?.(video.currentTime, video.duration);
      player?.destroy();
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [attempt, playlistUrl, visible]);

  return (
    <div className="bunny-hls-player" ref={containerRef}>
      <video
        ref={videoRef}
        controls
        playsInline
        crossOrigin="anonymous"
        preload="metadata"
        aria-label={title}
        onLoadedMetadata={(event) => {
          missingPlaylistRetries.current = 0;
          setWaitingForCdn(false);
          const video = event.currentTarget;
          if (resumeAt > 2 && (!Number.isFinite(video.duration) || resumeAt < video.duration - 2)) {
            video.currentTime = resumeAt;
          }
        }}
        onTimeUpdate={(event) => progressRef.current?.(event.currentTarget.currentTime, event.currentTarget.duration)}
        onPause={(event) => progressRef.current?.(event.currentTarget.currentTime, event.currentTarget.duration)}
        onSeeked={(event) => progressRef.current?.(event.currentTarget.currentTime, event.currentTarget.duration)}
        onError={() => { if (!waitingForCdn) setError((current) => current || "Ошибка воспроизведения видео. Проверьте доступ к потоку."); }}
        onPlaying={() => { missingPlaylistRetries.current = 0; setError(""); setWaitingForCdn(false); }}
      />
      {waitingForCdn && !error ? <div className="bunny-hls-player__waiting" role="status">Видео публикуется на CDN. Повторяем подключение…</div> : null}
      {error ? (
        <div className="bunny-hls-player__error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setAttempt((current) => current + 1)}>Повторить</button>
        </div>
      ) : null}
    </div>
  );
}
