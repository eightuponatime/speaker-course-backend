import logosVoiceLogo from "../../assets/images/transparent_logo.png";

type PreloadScreenProps = {
  label?: string;
};

export function PreloadScreen({ label }: PreloadScreenProps) {
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
