import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-12 w-full rounded-full border border-[var(--border)] bg-[#fffaf3] px-5 py-3 text-base text-[var(--foreground)] shadow-none outline-none transition placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)]/50 focus:bg-white focus:ring-4 focus:ring-[color:var(--ring)]/12",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";

export { Input };
