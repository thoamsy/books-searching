import { useEffect, useState } from "react";
import { BookOpenText } from "lucide-react";
import { cn } from "@/lib/utils";

interface BookCoverProps {
  src: string | null;
  title: string;
  className?: string;
  loading?: "lazy" | "eager";
}

export function BookCover({ src, title, className, loading = "eager" }: BookCoverProps) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [src]);

  if (src && !imageFailed) {
    return (
      <img
        src={src}
        alt=""
        loading={loading}
        className={cn("h-full w-full rounded-lg object-cover", className)}
        onError={() => setImageFailed(true)}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex h-full w-full items-center justify-center rounded-lg border border-[var(--border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(231,211,185,0.94))] text-[var(--muted-foreground)]",
        className
      )}
    >
      <BookOpenText className="size-10" />
    </div>
  );
}
