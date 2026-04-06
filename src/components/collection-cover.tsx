import { cn } from "@/lib/utils";

export function CollectionCover({
  urls,
  title,
  className,
}: {
  urls: string[];
  title: string;
  className?: string;
}) {
  const slots = Array.from({ length: 4 }, (_, i) => urls[i] ?? null);

  return (
    <div
      className={cn(
        "aspect-[4/5] overflow-hidden rounded-lg border border-white/60 bg-accent shadow-warm-sm",
        className
      )}
    >
      <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-px">
        {slots.map((url, i) =>
          url ? (
            <img
              key={i}
              src={url}
              alt={`${title} cover ${i + 1}`}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div key={i} className="h-full w-full bg-accent" />
          )
        )}
      </div>
    </div>
  );
}
