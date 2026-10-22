import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import Hls from "hls.js";
import { bunnyStreamCdnBaseUrl } from "../config/media";
import "./style.css";

const videoId = "519e82d9-d077-433e-a4ee-8cbd6466cae9";
const playlistUrl = `${bunnyStreamCdnBaseUrl}/${videoId}/playlist.m3u8`;
const cdnHost = new URL(bunnyStreamCdnBaseUrl).hostname;

function HlsTestPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState("Подключение к HLS-потоку…");
  const [error, setError] = useState("");
  const [engine, setEngine] = useState("");

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlaying = () => {
      setStatus(`Видео воспроизводится через ${cdnHost}`);
      setError("");
    };
    const onVideoError = () => {
      setStatus("Ошибка воспроизведения");
      setError(`Браузер сообщил об ошибке видео (код ${video.error?.code ?? "неизвестен"}). Проверьте запросы к ${cdnHost} в Network.`);
    };
    video.addEventListener("playing", onPlaying);
    video.addEventListener("error", onVideoError);

    let hls: Hls | undefined;
    if (Hls.isSupported()) {
      setEngine("hls.js");
      hls = new Hls();
      hls.on(Hls.Events.MANIFEST_PARSED, () => setStatus("Плейлист загружен. Нажмите ▶ для проверки воспроизведения."));
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;
        const httpStatus = data.response?.code;
        const requestUrl = data.context?.url;
        setStatus("Ошибка загрузки HLS");
        setError(
          `${data.details}${httpStatus ? ` · HTTP ${httpStatus}` : ""}${requestUrl ? ` · ${requestUrl}` : ""}. ` +
          "HTTP 403 обычно указывает на ограничения Bunny (Referer/Allowed domains или токен); " +
          "ошибка CORS может скрывать HTTP-статус. Проверьте Network в DevTools."
        );
      });
      hls.loadSource(playlistUrl);
      hls.attachMedia(video);
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      setEngine("Встроенный HLS браузера");
      video.src = playlistUrl;
      setStatus("Нажмите ▶ для проверки воспроизведения.");
    } else {
      setStatus("HLS не поддерживается этим браузером");
    }

    return () => {
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("error", onVideoError);
      hls?.destroy();
      video.removeAttribute("src");
      video.load();
    };
  }, []);

  return (
    <main className="hls-test">
      <a className="hls-test__brand" href="/">◯ <span>UMBRA</span></a>
      <p className="hls-test__eyebrow">Изолированная проверка · Bunny Stream</p>
      <h1>Проверка HLS через {cdnHost}</h1>
      <p>Эта страница использует тестовое видео и не меняет плеер курса.</p>
      <video ref={videoRef} controls playsInline crossOrigin="anonymous" preload="metadata" />
      <p className="hls-test__status" role="status">{status}</p>
      {error && <p className="hls-test__error" role="alert">{error}</p>}
      <dl>
        <div><dt>Движок</dt><dd>{engine || "—"}</dd></div>
        <div><dt>Плейлист</dt><dd><a href={playlistUrl}>{playlistUrl}</a></dd></div>
        <div><dt>Origin тестовой страницы</dt><dd>{window.location.origin}</dd></div>
      </dl>
      <p className="hls-test__note">
        Если включён Block direct url file access, добавьте hostname тестовой страницы в Bunny Stream → Security → Allowed domains
        (например, localhost без схемы и порта). Браузер отправляет Referer сам; эта страница использует
        strict-origin-when-cross-origin. В DevTools → Network проверьте Referer, HTTP-статус и CORS для playlist.m3u8 и сегментов.
        При включённой защите файлов токеном или MediaCage DRM одного Referer недостаточно.
      </p>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<HlsTestPage />);
