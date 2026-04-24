import { useMemo } from "react";
import { Laptop, Moon, Smartphone, Sun } from "lucide-react";
import { useTheme, type ThemeMode } from "@/lib/theme-context";
import { cn } from "@/lib/utils";

function detectDevice(): "ios" | "android" | "desktop" {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { mode, setMode } = useTheme();
  const device = useMemo(detectDevice, []);
  const DeviceIcon = device === "desktop" ? Laptop : Smartphone;
  const deviceLabel =
    device === "ios" ? "跟随 iOS" : device === "android" ? "跟随 Android" : "跟随桌面";

  const options: ReadonlyArray<{
    value: ThemeMode;
    label: string;
    Icon: typeof Sun;
  }> = [
    { value: "light", label: "浅色", Icon: Sun },
    { value: "dark", label: "深色", Icon: Moon },
    { value: "system", label: deviceLabel, Icon: DeviceIcon },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="主题"
      className={cn(
        "flex items-center gap-0.5 rounded-full border border-border bg-muted/50 p-0.5",
        className,
      )}
    >
      {options.map(({ value, label, Icon }) => {
        const selected = mode === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={label}
            title={label}
            onClick={() => setMode(value)}
            className={cn(
              "flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors",
              selected
                ? "bg-background text-foreground shadow-warm-xs"
                : "hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" />
          </button>
        );
      })}
    </div>
  );
}
