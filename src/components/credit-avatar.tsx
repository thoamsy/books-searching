import { DepthLink } from "@/components/depth-link";
import { cn } from "@/lib/utils";

interface CreditAvatarProps {
  name: string;
  id?: string;
  avatarUrl?: string;
  variant?: "director" | "cast";
  size?: "md" | "sm";
  className?: string;
}

export function CreditAvatar({
  name,
  id,
  avatarUrl,
  variant = "cast",
  size = "md",
  className,
}: CreditAvatarProps) {
  const to = id ? `/celebrity/${id}` : `/?q=${encodeURIComponent(name)}`;

  return (
    <DepthLink
      to={to}
      aria-label={variant === "director" ? `导演 ${name}` : `演员 ${name}`}
      className={cn(
        "group/avatar flex shrink-0 flex-col items-center gap-1.5",
        size === "md" ? "w-[68px] sm:w-[76px]" : "w-[60px]",
        className,
      )}
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-full bg-surface shadow-warm-sm transition-all duration-300 ease-out group-hover/avatar:-translate-y-0.5 group-hover/avatar:shadow-warm-md",
          size === "md" ? "size-14 sm:size-16" : "size-12",
          variant === "director"
            ? "ring-2 ring-primary/40 group-hover/avatar:ring-primary/70"
            : "ring-2 ring-border-edge group-hover/avatar:ring-border-strong",
        )}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-surface via-muted to-accent text-muted-foreground">
            <span
              className={cn(
                "font-display",
                size === "md" ? "text-lg" : "text-base",
              )}
            >
              {name.charAt(0) || "?"}
            </span>
          </div>
        )}
      </div>
      <p
        className={cn(
          "w-full truncate text-center leading-tight transition-colors",
          size === "md" ? "text-xs" : "text-[11px]",
          variant === "director"
            ? "font-medium text-primary group-hover/avatar:text-primary/80"
            : "text-foreground group-hover/avatar:text-primary",
        )}
      >
        {name}
      </p>
    </DepthLink>
  );
}
