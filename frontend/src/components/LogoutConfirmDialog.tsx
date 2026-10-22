import { useEffect, useRef, useState } from "react";
import "../styles/logout-confirm.css";

export function LogoutConfirmDialog({
  onCancel, onConfirm, legacy = false
}: {
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
  legacy?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className={`logout-confirm${legacy ? " logout-confirm-legacy" : ""}`}
      aria-labelledby="logout-confirm-title"
      aria-describedby="logout-confirm-description"
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onCancel();
      }}
    >
      <h2 id="logout-confirm-title">Выйти из аккаунта?</h2>
      <p id="logout-confirm-description">Чтобы вернуться к материалам курса, потребуется войти снова.</p>
      <div className="logout-confirm-actions">
        <button type="button" autoFocus disabled={pending} onClick={onCancel}>Остаться</button>
        <button className="confirm" type="button" disabled={pending} onClick={async () => {
          if (pending) return;
          setPending(true);
          setError("");
          try {
            await onConfirm();
            onCancel();
          } catch {
            setError("Не удалось выйти. Попробуйте ещё раз.");
            setPending(false);
          }
        }}>{pending ? "Выходим…" : "Выйти"}</button>
      </div>
      {error ? <p role="alert">{error}</p> : null}
    </dialog>
  );
}
