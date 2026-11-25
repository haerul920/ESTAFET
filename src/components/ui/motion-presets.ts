/**
 * Motion hover for round icon buttons. MotionConfig turns the movement off for reduced motion.
 *
 * Never add `whileTap` here. For keyboard users Motion turns Enter into a synthetic `pointerdown`, which a Radix
 * menu trigger reads as a second press: the menu opens and closes again at once. The pressed state is CSS
 * (`.icon-press` in motion.css).
 */
export const iconMotion = {
  whileHover: { rotate: 8, scale: 1.06 },
};
