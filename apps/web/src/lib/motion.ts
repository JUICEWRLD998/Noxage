/** Shared motion tokens — keep in sync with styles/motion.css */

export const easings = {
  outExpo: [0.16, 1, 0.3, 1] as const,
  outQuart: [0.25, 1, 0.5, 1] as const,
  inOut: [0.65, 0, 0.35, 1] as const,
  spring: [0.34, 1.56, 0.64, 1] as const,
};

export const durationsSec = {
  1: 0.12,
  2: 0.2,
  3: 0.32,
  4: 0.5,
  5: 0.8,
} as const;

export const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const tBase = { duration: durationsSec[3], ease: easings.outExpo };

export const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: tBase },
};

export const fadeIn = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: tBase },
};

export const scaleIn = {
  hidden: { opacity: 0, scale: 0.96 },
  show: { opacity: 1, scale: 1, transition: tBase },
};

export const staggerParent = (stagger = 0.08, delay = 0) => ({
  hidden: {},
  show: {
    transition: { staggerChildren: stagger, delayChildren: delay },
  },
});

export const springTap = {
  whileTap: { scale: 0.97 },
  transition: { type: "spring" as const, stiffness: 400, damping: 22 },
};

export const inView = { once: true, amount: 0.3 } as const;
