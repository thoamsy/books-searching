import { useRef } from "react";
import {
  LazyMotion,
  domMax,
  m,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** "book" applies soft-light paper glare + spine shadow; "poster" applies glossy overlay glare */
  variant?: "book" | "poster";
  /** Max tilt angle in degrees (default 8) */
  strength?: number;
}

const springConfig = { stiffness: 300, damping: 20, mass: 0.5 };

export function TiltCard({
  children,
  className,
  style,
  variant = "poster",
  strength = 8,
}: TiltCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);

  const rotateX = useSpring(useTransform(my, [0, 1], [strength, -strength]), springConfig);
  const rotateY = useSpring(useTransform(mx, [0, 1], [-strength, strength]), springConfig);
  const scale = useSpring(1, springConfig);

  const glareX = useTransform(mx, (v) => `${v * 100}%`);
  const glareY = useTransform(my, (v) => `${v * 100}%`);
  const glareOpacity = useSpring(0, springConfig);

  const glareBackground = useTransform(
    [glareX, glareY],
    ([x, y]) =>
      variant === "book"
        ? `radial-gradient(circle at ${x} ${y}, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.15) 35%, transparent 70%)`
        : `radial-gradient(ellipse at ${x} ${y}, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.2) 40%, transparent 70%)`,
  );

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (prefersReducedMotion) return;
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    mx.set((e.clientX - rect.left) / rect.width);
    my.set((e.clientY - rect.top) / rect.height);
    scale.set(1.03);
    glareOpacity.set(1);
  }

  function handleMouseLeave() {
    mx.set(0.5);
    my.set(0.5);
    scale.set(1);
    glareOpacity.set(0);
  }

  return (
    <LazyMotion features={domMax} strict>
      <m.div
        ref={cardRef}
        className={cn(
          "relative [transform-style:preserve-3d]",
          className,
        )}
        style={{
          ...style,
          rotateX,
          rotateY,
          scale,
          perspective: 600,
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {children}
        <m.div
          className={cn(
            "pointer-events-none absolute inset-0 rounded-[inherit]",
            variant === "book" ? "mix-blend-soft-light" : "mix-blend-overlay",
          )}
          style={{
            opacity: glareOpacity,
            background: glareBackground,
          }}
        />
        {variant === "book" && (
          <div className="pointer-events-none absolute inset-0 rounded-[inherit] [background:linear-gradient(90deg,rgba(0,0,0,0.18)_0%,rgba(0,0,0,0.08)_1.5%,transparent_6%,transparent_93%,rgba(0,0,0,0.05)_100%)]" />
        )}
      </m.div>
    </LazyMotion>
  );
}
