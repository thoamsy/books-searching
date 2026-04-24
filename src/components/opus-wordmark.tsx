import { cn } from "@/lib/utils";

interface OpusWordmarkProps {
  className?: string;
  as?: "span" | "div";
}

export function OpusWordmark({ className, as: Tag = "span" }: OpusWordmarkProps) {
  return (
    <Tag
      aria-label="Opus"
      className={cn(
        "font-display italic font-medium tracking-tight leading-none",
        className,
      )}
    >
      <span className="text-primary">O</span>
      <span className="text-foreground">pus</span>
    </Tag>
  );
}
