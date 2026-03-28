import type * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-full px-3 py-1 text-xs font-medium", {
  variants: {
    variant: {
      default: "border border-[var(--border)] bg-white/75 text-[var(--foreground)]",
      accent: "border border-[var(--primary)]/15 bg-[var(--primary)]/8 text-[var(--primary)]"
    }
  },
  defaultVariants: {
    variant: "default"
  }
});

function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
