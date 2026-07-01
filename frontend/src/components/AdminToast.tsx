type AdminToastProps = {
  message: string;
  tone?: "success" | "error" | "neutral";
};

export function AdminToast({ message, tone = "success" }: AdminToastProps) {
  if (!message) return null;

  return (
    <div className={`admin-toast ${tone}`} role="status">
      {message}
    </div>
  );
}
