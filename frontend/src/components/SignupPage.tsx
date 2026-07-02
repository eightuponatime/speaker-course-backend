import { useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";

import { registerWithInvitationCode } from "../api/authDatasource";
import { apiBaseUrl } from "../api/http";
import { useAssetPreload } from "../utils/preload";
import { PreloadScreen } from "./PreloadScreen";
import logosVoiceLogo from "../../assets/images/transparent_logo.png";
import signUpBackground from "../../assets/images/sign_up_screen_background.png";
import signUpUpperLaurel from "../../assets/images/sign_up_upper_laurel.png";
import laurelLeft from "../../assets/images/laurel-left.png";
import laurelRight from "../../assets/images/laurel-right.png";

type SignupPageProps = {
  onLoginOpen?: () => void;
};

export function SignupPage({}: SignupPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const inviteCode = readInviteCode();
  const canSubmit = inviteCode.length > 0 && email.trim().length > 0 && password.length > 0 && fullName.trim().length > 0;
  const googleSignupUrl = `${apiBaseUrl}/auth/google/invitation/start?code=${encodeURIComponent(inviteCode)}`;
  const criticalAssetsReady = useAssetPreload(signupCriticalImages, {
    minDelayMs: 300,
    timeoutMs: 2500
  });

  if (!criticalAssetsReady) {
    return <PreloadScreen label="Загрузка регистрации" />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) {
      setMessage(inviteCode ? "Заполните все поля." : "Ссылка регистрации не содержит код приглашения.");
      return;
    }

    setSubmitting(true);
    setMessage("");
    try {
      await registerWithInvitationCode({
        code: inviteCode,
        email,
        password,
        fullName
      });
      window.location.assign("/?app_route=%2Fcourse");
    } catch (err) {
      setMessage(formatSignupError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="signup-page" style={{ "--signup-bg": `url(${signUpBackground})` } as CSSProperties}>
      <header className="signup-header">
        <a className="signup-brand" href="/" aria-label="Logos Voice">
          <img src={logosVoiceLogo} alt="" />
          <span>
            <strong>LOGOS</strong>
            <small>VOICE</small>
          </span>
        </a>
      </header>

      <section className="signup-shell" aria-label="Регистрация по приглашению">
        {!inviteCode ? (
          <div className="signup-card signup-card-locked">
            <div className="signup-card-mark" aria-hidden="true" />
            <div className="signup-card-heading">
              <h1>Регистрация по приглашению</h1>
              <p>Для регистрации нужна персональная одноразовая ссылка.</p>
            </div>
            <div className="signup-invite-note">
              <ShieldCheck size={20} strokeWidth={1.7} />
              <span>Откройте страницу по ссылке с кодом приглашения</span>
            </div>
          </div>
        ) : (
        <form className="signup-card" onSubmit={handleSubmit}>
          <div className="signup-card-mark" aria-hidden="true" />
          <div className="signup-card-heading">
            <h1>Регистрация по приглашению</h1>
            <p>Заполните данные, чтобы активировать доступ к курсу</p>
          </div>

          <div className="signup-fields">
            <label>
              <span>Email</span>
              <input
                autoComplete="email"
                placeholder="Введите ваш email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>

            <label>
              <span>Пароль</span>
              <span className="signup-password-field">
                <input
                  autoComplete="new-password"
                  placeholder="Введите пароль"
                  type={passwordVisible ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  type="button"
                  aria-label={passwordVisible ? "Скрыть пароль" : "Показать пароль"}
                  onClick={() => setPasswordVisible((value) => !value)}
                >
                  {passwordVisible ? <EyeOff size={19} strokeWidth={1.8} /> : <Eye size={19} strokeWidth={1.8} />}
                </button>
              </span>
            </label>

            <label>
              <span>Имя</span>
              <input
                autoComplete="name"
                placeholder="Введите ваше имя"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
              />
            </label>
          </div>

          <button className="signup-submit" type="submit" disabled={submitting || !canSubmit}>
            {submitting ? "Подождите..." : "Завершить регистрацию"}
          </button>

          <a className="signup-google" href={googleSignupUrl}>
            <GoogleIcon />
            <span>Зарегистрироваться через Google</span>
          </a>

          <div className="signup-invite-note">
            <ShieldCheck size={20} strokeWidth={1.7} />
            <span>{inviteCode ? "Персональная ссылка • доступна для 1 регистрации" : "Нужна персональная ссылка с кодом"}</span>
          </div>
          {message ? <p className="signup-message">{message}</p> : null}
        </form>
        )}
      </section>
    </main>
  );
}

const signupCriticalImages = [
  logosVoiceLogo,
  signUpBackground,
  signUpUpperLaurel,
  laurelLeft,
  laurelRight
];

function readInviteCode(): string {
  const pathParts = window.location.pathname.split("/").filter(Boolean);
  const pathCode = pathParts[0] === "signup" ? pathParts[1]?.trim() : "";
  if (!pathCode) return "";

  try {
    return decodeURIComponent(pathCode);
  } catch {
    return "";
  }
}

function formatSignupError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();
  if (lower.includes("code is expired") || lower.includes("invitation code")) {
    return "Код приглашения недействителен, истек или уже был использован.";
  }
  if (lower.includes("email") && lower.includes("exists")) return "Аккаунт с таким email уже существует.";
  if (lower.includes("password must contain at least 8 characters")) return "Пароль должен быть не короче 8 символов.";
  if (lower.includes("password is empty")) return "Введите пароль.";
  if (lower.includes("email is empty")) return "Введите email.";
  return "Не удалось завершить регистрацию. Проверьте данные и попробуйте снова.";
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.24 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.3 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}
