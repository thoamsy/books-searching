import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { useLocation } from "react-router-dom";
import { BackButton } from "@/components/back-button";
import { BookmarkButton } from "@/components/bookmark-button";
import { ShareButton } from "@/components/share-button";
import { UserMenu } from "@/components/user-menu";

const DETAIL_PATH_PATTERN = /^\/(book|movie|celebrity|author|collection)\//;

export function TopBar() {
  const { pathname } = useLocation();
  const isHome = pathname === "/";
  const isDetail = DETAIL_PATH_PATTERN.test(pathname);

  const rightKey = isHome ? "user-menu" : isDetail ? "detail-actions" : "empty";

  return (
    <MotionConfig reducedMotion="user">
      <nav className="flex items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))] sm:px-8">
        <div>{!isHome && <BackButton />}</div>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={rightKey}
            initial={{ opacity: 0, filter: "blur(4px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, filter: "blur(4px)" }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {isHome ? (
              <UserMenu />
            ) : isDetail ? (
              <div className="flex items-center gap-1">
                <BookmarkButton />
                <ShareButton />
              </div>
            ) : null}
          </motion.div>
        </AnimatePresence>
      </nav>
    </MotionConfig>
  );
}
