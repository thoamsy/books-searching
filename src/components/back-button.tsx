import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

export function BackButton() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <button
      type="button"
      onClick={() => location.key !== "default" ? navigate(-1) : navigate("/")}
      className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/65 px-4 py-2 text-sm text-[var(--muted-foreground)] transition hover:text-[var(--foreground)]"
    >
      <ArrowLeft className="size-4" />
      返回
    </button>
  );
}
