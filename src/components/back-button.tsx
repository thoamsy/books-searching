import { useCallback } from "react";
import { MotionConfig, motion, AnimatePresence } from "framer-motion";
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

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        className="inline-flex items-center overflow-hidden rounded-full border border-border-edge bg-surface"
        layout
        transition={{ layout: springConfig }}
      >
        <motion.button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          layout
          transition={{ layout: springConfig }}
        >
          <ArrowLeft className="size-4" />
          返回
        </motion.button>

        <AnimatePresence>
          {showHome && (
            <motion.div
              className="flex items-center"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: "auto", opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={springConfig}
            >
              <motion.div
                className="h-4 w-px bg-border-strong"
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                exit={{ scaleY: 0 }}
                transition={{ ...springConfig, delay: 0.05 }}
              />

              <motion.button
                type="button"
                onClick={() => navigate("/")}
                aria-label="返回首页"
                className="inline-flex items-center px-3 py-2 text-muted-foreground transition-colors hover:text-foreground"
                initial={{ opacity: 0, scale: 0.6, x: -8, rotate: -10 }}
                animate={{ opacity: 1, scale: 1, x: 0, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.6, x: -8, rotate: -10 }}
                transition={springConfig}
              >
                <Home aria-hidden className="size-4 transition-transform hover:-translate-y-px" />
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </MotionConfig>
  );
}
