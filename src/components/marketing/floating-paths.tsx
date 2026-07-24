"use client";

import { motion, useReducedMotion } from "framer-motion";

function PathLayer({ position, animate }: { position: number; animate: boolean }) {
  const paths = Array.from({ length: 36 }, (_, i) => ({
    id: i,
    d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${
      380 - i * 5 * position
    } -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${
      152 - i * 5 * position
    } ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${
      684 - i * 5 * position
    } ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
    width: 0.5 + i * 0.03,
    opacity: 0.06 + i * 0.014,
  }));

  return (
    <svg
      className="absolute inset-0 h-full w-full text-brand-light"
      viewBox="0 0 696 316"
      fill="none"
      aria-hidden="true"
    >
      {paths.map((path) => (
        <motion.path
          key={path.id}
          d={path.d}
          stroke="currentColor"
          strokeWidth={path.width}
          strokeOpacity={path.opacity}
          initial={{ pathLength: 0.3, opacity: 0.4 }}
          animate={
            animate
              ? { pathLength: 1, opacity: [0.2, 0.5, 0.2], pathOffset: [0, 1, 0] }
              : { pathLength: 1, opacity: 0.35 }
          }
          transition={
            animate
              ? { duration: 20 + (path.id % 10), repeat: Infinity, ease: "linear" }
              : { duration: 0 }
          }
        />
      ))}
    </svg>
  );
}

/**
 * Ambient animated line-path texture. Absolutely positioned — the parent
 * needs `relative overflow-hidden`. Framer Motion's JS-driven animations
 * don't stop on their own for prefers-reduced-motion (that CSS media rule
 * only catches CSS transitions/animations), so useReducedMotion is checked
 * explicitly and the paths render static instead of looping.
 */
export function FloatingPathsBackdrop() {
  const prefersReducedMotion = useReducedMotion();
  const animate = !prefersReducedMotion;

  return (
    <div className="pointer-events-none absolute inset-0">
      <PathLayer position={1} animate={animate} />
      <PathLayer position={-1} animate={animate} />
    </div>
  );
}
