import { Check, Share } from "lucide-react";
import { useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { cn } from "@/lib/utils";

type ShareState = "idle" | "copied";

export function ShareButton() {
  const [state, setState] = useState<ShareState>("idle");
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function handleShare() {
    const url = window.location.href;
    const title = document.title || undefined;

    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ url, title });
        return;
      } catch (err) {
        // User dismissed the share sheet — treat as no-op.
        if (err instanceof DOMException && err.name === "AbortError") return;
        // Fall through to clipboard fallback on real errors.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setState("copied");
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setState("idle"), 1600);
    } catch {
      // Clipboard unavailable — silently ignore.
    }
  }

  const copied = state === "copied";

  return (
    <MotionConfig reducedMotion="user">
      <motion.button
        type="button"
        onClick={handleShare}
        aria-label={copied ? "链接已复制" : "分享"}
        className="relative inline-flex items-center justify-center rounded-full p-2 transition hover:bg-accent"
        whileTap={{ scale: 0.85 }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
      >
        <span className="relative inline-flex size-5 items-center justify-center">
          <AnimatePresence initial={false} mode="popLayout">
            {copied ? (
              <motion.span
                key="check"
                className="absolute inline-flex"
                initial={{ scale: 0.4, opacity: 0, rotate: -20 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 0.6, opacity: 0 }}
                transition={{ type: "spring", stiffness: 360, damping: 22 }}
              >
                <Check className={cn("size-5 text-star")} />
              </motion.span>
            ) : (
              <motion.span
                key="share"
                className="absolute inline-flex"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                transition={{ type: "spring", stiffness: 360, damping: 22 }}
              >
                <Share className="size-5 text-muted-foreground" />
              </motion.span>
            )}
          </AnimatePresence>
        </span>
      </motion.button>
    </MotionConfig>
  );
}
