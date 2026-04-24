import { useCallback, useEffect, useState } from "react";
import { BookOpenText } from "lucide-react";
import { cn } from "@/lib/utils";

// Track URLs that have loaded successfully so we can skip fade-in on re-mount
const loadedSrcs = new Set<string>();

interface BookCoverProps {
  src: string | null;
  title: string;
  className?: string;
  loading?: "lazy" | "eager";
}

export function BookCover({ src, title, className, loading = "eager" }: BookCoverProps) {
  const alreadySeen = src != null && loadedSrcs.has(src);
  const [imageFailed, setImageFailed] = useState(false);
  const [loaded, setLoaded] = useState(alreadySeen);

  useEffect(() => {
    setImageFailed(false);
    setLoaded(src != null && loadedSrcs.has(src));
  }, [src]);

  const handleRef = useCallback(
    (el: HTMLImageElement | null) => {
      if (el?.complete && el.naturalWidth > 0) {
        setLoaded(true);
        if (src) loadedSrcs.add(src);
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
          "h-full w-full rounded-lg object-cover",
          !alreadySeen && "transition-opacity duration-500 ease-out",
          loaded || alreadySeen ? "opacity-100" : "opacity-0",
          className,
        )}
        onLoad={() => {
          setLoaded(true);
          loadedSrcs.add(src);
        }}
        onError={() => setImageFailed(true)}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex h-full w-full items-center justify-center rounded-lg border border-border bg-gradient-to-b from-surface to-muted text-muted-foreground",
        className
      )}
    >
      <BookOpenText className="size-10" />
    </div>
  );
}
