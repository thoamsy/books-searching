import { useCallback } from "react";
import { LazyMotion, MotionConfig, domMax, m, AnimatePresence } from "framer-motion";
import { ArrowLeft, Home } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useNavDepth } from "@/hooks/use-nav-depth";

const springConfig = { stiffness: 400, damping: 22, mass: 0.8 };

export function BackButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const depth = useNavDepth();
  const showHome = depth >= 2;

  const handleBack = useCallback(() => {
    if (location.key !== "default") {
      navigate(-1);
    } else {
      navigate("/");
    }
  }, [location.key, navigate]);

  const handleHome = useCallback(() => {
    navigate("/");
  }, [navigate]);

  return (
    <MotionConfig reducedMotion="user">
    <LazyMotion features={domMax} strict>
      <m.div
        className="inline-flex items-center overflow-hidden rounded-full border border-white/70 bg-white/65"
        layout
        transition={{ layout: springConfig }}
      >
        {/* Back button (always visible) */}
        <m.button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
          layout
          transition={{ layout: springConfig }}
        >
          <ArrowLeft className="size-4" />
          返回
        </m.button>

        {/* Divider + Home button (conditional) */}
        <AnimatePresence>
          {showHome && (
            <m.div
              className="flex items-center"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: "auto", opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={springConfig}
            >
              {/* Divider line */}
              <m.div
                className="h-4 w-px bg-white/40"
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                exit={{ scaleY: 0 }}
                transition={{ ...springConfig, delay: 0.05 }}
              />

              {/* Home button */}
              <m.button
                type="button"
                onClick={handleHome}
                aria-label="返回首页"
                className="inline-flex items-center px-3 py-2 text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                initial={{ opacity: 0, scale: 0.6, x: -8, rotate: -10 }}
                animate={{ opacity: 1, scale: 1, x: 0, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.6, x: -8, rotate: -10 }}
                transition={springConfig}
              >
                <Home aria-hidden className="size-4 transition-transform hover:-translate-y-px" />
              </m.button>
            </m.div>
          )}
        </AnimatePresence>
      </m.div>
    </LazyMotion>
    </MotionConfig>
  );
}
