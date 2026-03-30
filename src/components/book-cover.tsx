import { useCallback, useEffect, useRef, useState } from "react";
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
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setImageFailed(false);
    setLoaded(false);
  }, [src]);

  // Handle images that are already cached (complete before onLoad fires)
  const handleRef = useCallback(
    (el: HTMLImageElement | null) => {
      (imgRef as React.MutableRefObject<HTMLImageElement | null>).current = el;
      if (el?.complete && el.naturalWidth > 0) {
        setLoaded(true);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [src],
  );

  if (src && !imageFailed) {
    return (
      <img
        ref={handleRef}
        src={src}
        alt=""
        loading={loading}
        className={cn(
          "h-full w-full rounded-lg object-cover transition-opacity duration-500 ease-out",
          loaded ? "opacity-100" : "opacity-0",
          className,
        )}
        onLoad={() => setLoaded(true)}
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
