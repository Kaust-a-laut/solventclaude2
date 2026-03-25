import { useAppStore } from '../store/useAppStore';

type AnimationVariant = {
  initial: Record<string, any>;
  animate: Record<string, any>;
  exit?: Record<string, any>;
  transition?: Record<string, any>;
};

/**
 * Returns appropriate animation props based on the active tier.
 * - Full tier: uses Framer Motion spring physics
 * - Lite tier: uses simple CSS-friendly transitions (opacity/transform only)
 */
export function useTierAnimation(
  type: 'fadeIn' | 'slideUp' | 'scaleIn' | 'hero'
): AnimationVariant {
  const activeTier = useAppStore(state => state.activeTier);
  const isLite = activeTier === 'lite';

  switch (type) {
    case 'fadeIn':
      return {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: isLite
          ? { duration: 0.15, ease: 'easeOut' }
          : { type: 'spring', stiffness: 300, damping: 30 },
      };

    case 'slideUp':
      return {
        initial: { opacity: 0, y: 15 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -10 },
        transition: isLite
          ? { duration: 0.15, ease: 'easeOut' }
          : { type: 'spring', stiffness: 400, damping: 25 },
      };

    case 'scaleIn':
      return {
        initial: { scale: 0.95, opacity: 0 },
        animate: { scale: 1, opacity: 1 },
        exit: { scale: 0.95, opacity: 0 },
        transition: isLite
          ? { duration: 0.12, ease: 'easeOut' }
          : { type: 'spring', stiffness: 400, damping: 30 },
      };

    case 'hero':
      // Hero animations always use spring physics regardless of tier
      return {
        initial: { scale: 0.9, opacity: 0, y: 20 },
        animate: { scale: 1, opacity: 1, y: 0 },
        exit: { scale: 0.9, opacity: 0, y: 20 },
        transition: { type: 'spring', stiffness: 300, damping: 25 },
      };
  }
}

/**
 * On lite tier, disables layout animations that trigger expensive recalculations.
 * Returns the `layout` prop value for motion components.
 */
export function useTierLayout(): boolean | 'position' {
  const activeTier = useAppStore(state => state.activeTier);
  return activeTier === 'lite' ? false : true;
}
