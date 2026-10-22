import logosVoiceLogo from "../../assets/images/transparent_logo.png";
import { UmbraLogo } from "./umbra/UmbraLogo";
import "../styles/preload.css";

type PreloadScreenProps = {
  label?: string;
  legacy?: boolean;
};

export function PreloadScreen({ label, legacy = false }: PreloadScreenProps) {
  if (!legacy) {
    return (
      <main className="umbra-preload" aria-busy="true" aria-label={label || "Загрузка сайта"}>
        <div className="umbra-preload-brand">
          <UmbraLogo size={58} />
          <div>
            <strong>UMBRA</strong>
            <span>Искусство влияния</span>
          </div>
        </div>
        <div className="umbra-preload-bar" aria-hidden="true" />
      </main>
    );
  }

  return (
    <main className="landing-preload-screen" aria-busy="true" aria-label={label || "Загрузка сайта"}>
      <div className="landing-preload-brand">
        <img src={logosVoiceLogo} alt="" />
        <span>
          <strong>LOGOS</strong>
          <small>VOICE</small>
        </span>
      </div>
      <div className="landing-preload-bar" aria-hidden="true" />
    </main>
  );
}
