/**
 * Solvent AI Logo Component
 * 
 * A comprehensive, reusable logo system with multiple variants,
 * enhanced animations, and full accessibility support.
 * 
 * @component
 */

import React, { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';

export type LogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
export type LogoVariant = 'beaker' | 'text' | 'combined' | 'icon' | 'minimal' | 'hero';
export type LogoState = 'idle' | 'hover' | 'active' | 'loading';

export interface LogoProps {
  /** Size preset or custom pixel value */
  size?: LogoSize | number;
  /** Logo variant to display */
  variant?: LogoVariant;
  /** Animation state */
  state?: LogoState;
  /** Disable all animations */
  animated?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Click handler */
  onClick?: () => void;
  /** Opacity level (0-1) */
  opacity?: number;
  /** Show simplified version for mobile/performance */
  simplified?: boolean;
  /** Custom color scheme */
  colorScheme?: 'default' | 'monochrome' | 'accent' | 'purple' | 'cyan';
  /** Aria label for accessibility */
  ariaLabel?: string;
}

const sizeMap: Record<LogoSize, number> = {
  xs: 16,
  sm: 32,
  md: 64,
  lg: 128,
  xl: 200,
  full: 400,
};

const Logo: React.FC<LogoProps> = memo(({
  size = 'md',
  variant = 'beaker',
  state = 'idle',
  animated = true,
  className,
  onClick,
  opacity = 1,
  simplified = false,
  colorScheme = 'default',
  ariaLabel = 'Solvent AI Logo',
}) => {
  const pixelSize = typeof size === 'number' ? size : sizeMap[size];
  const isInteractive = !!onClick;

  // Color schemes
  const colors = useMemo(() => {
    switch (colorScheme) {
      case 'monochrome':
        return { primary: '#FFFFFF', secondary: '#CCCCCC', accent: '#999999' };
      case 'accent':
        return { primary: '#3C71F7', secondary: '#9D5BD2', accent: '#FB923C' };
      case 'purple':
        return { primary: '#9D5BD2', secondary: '#7C3AAD', accent: '#BB6EE9' };
      case 'cyan':
        return { primary: '#06B6D4', secondary: '#0891B2', accent: '#22D3EE' };
      default:
        // Original TitleBar gradient: Orange -> Rose -> Purple
        return { primary: '#9D5BD2', secondary: '#F43F5E', accent: '#FB923C' };
    }
  }, [colorScheme]);

  // Animation durations based on size
  const fluidDuration = simplified ? 3 : size === 'full' ? 8 : 6;
  const bubbleCount = simplified ? 2 : size === 'full' ? 5 : 3;
  const showSparkles = !simplified && size !== 'xs' && size !== 'sm';
  const showNeuralNetwork = !simplified && size === 'full';

  const fluidTransition = {
    duration: fluidDuration,
    repeat: Infinity,
    ease: "easeInOut" as const,
  };

  const renderBeakerContent = () => (
    <>
      <defs>
        {/* Primary fluid gradient - matches original HomeArea with 4 stops and cycling */}
        <linearGradient id={`beakerFluid-${colorScheme}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={colors.accent}>
            {animated && <animate attributeName="stop-color" values={`${colors.accent};${colors.secondary};${colors.accent}`} dur="10s" repeatCount="indefinite" />}
          </stop>
          <stop offset="40%" stopColor={colors.secondary}>
            {animated && <animate attributeName="stop-color" values={`${colors.secondary};${colors.primary};${colors.secondary}`} dur="10s" repeatCount="indefinite" />}
          </stop>
          <stop offset="70%" stopColor={colors.primary}>
            {animated && <animate attributeName="stop-color" values={`${colors.primary};#06B6D4;${colors.primary}`} dur="10s" repeatCount="indefinite" />}
          </stop>
          <stop offset="100%" stopColor="#06B6D4">
            {animated && <animate attributeName="stop-color" values="#06B6D4;#3C71F7;#06B6D4" dur="10s" repeatCount="indefinite" />}
          </stop>
        </linearGradient>

        {/* Secondary fluid layer - matches original */}
        <linearGradient id={`beakerFluid2-${colorScheme}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={colors.accent} stopOpacity="0.6" />
          <stop offset="50%" stopColor={colors.primary} stopOpacity="0.5" />
          <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.6" />
        </linearGradient>

        {/* Rim highlight gradient */}
        <linearGradient id={`rimHighlight-${colorScheme}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="white" stopOpacity="0.8" />
          <stop offset="50%" stopColor="white" stopOpacity="0.3" />
          <stop offset="100%" stopColor="white" stopOpacity="0.6" />
        </linearGradient>

        {/* Glass refraction gradient */}
        <linearGradient id={`glassRefraction-${colorScheme}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="white" stopOpacity="0" />
          <stop offset="50%" stopColor="white" stopOpacity="0.08" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>

        {/* Glow filters */}
        <filter id={`glow-${colorScheme}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={simplified ? 2 : 4} result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>

        <filter id={`glowFluid-${colorScheme}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={2.5} result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>

        {/* Soft blur for meniscus blending */}
        <filter id={`meniscusBlur-${colorScheme}`} x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation={1.8} />
        </filter>
      </defs>

      {/* Neural network background pattern (hero size only) */}
      {showNeuralNetwork && animated && (
        <g opacity="0.08">
          <motion.path
            d="M25 70 L35 60 L45 65 L55 55 L65 60 L75 50"
            fill="none"
            stroke={colors.secondary}
            strokeWidth="0.5"
            strokeLinecap="round"
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.path
            d="M30 75 L40 68 L50 72 L60 65 L70 70"
            fill="none"
            stroke={colors.primary}
            strokeWidth="0.5"
            strokeLinecap="round"
            animate={{ opacity: [0.2, 0.5, 0.2] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
          />
          <motion.path
            d="M28 78 L38 73 L48 78 L58 73 L68 78"
            fill="none"
            stroke={colors.accent}
            strokeWidth="0.5"
            strokeLinecap="round"
            animate={{ opacity: [0.2, 0.4, 0.2] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          />
          {/* Neural nodes */}
          <motion.circle cx="35" cy="60" r="1" fill={colors.secondary} animate={{ opacity: [0.4, 0.8, 0.4] }} transition={{ duration: 3, repeat: Infinity }} />
          <motion.circle cx="55" cy="55" r="1" fill={colors.primary} animate={{ opacity: [0.4, 0.8, 0.4] }} transition={{ duration: 3.5, repeat: Infinity, delay: 0.3 }} />
          <motion.circle cx="65" cy="60" r="1" fill={colors.accent} animate={{ opacity: [0.4, 0.8, 0.4] }} transition={{ duration: 4, repeat: Infinity, delay: 0.6 }} />
        </g>
      )}

      {/* Beaker outline */}
      <path
        d="M38 22 L38 45 L18 82 Q15 88 22 88 L78 88 Q85 88 82 82 L62 45 L62 22"
        fill="none"
        stroke="white"
        strokeWidth={simplified ? 0.8 : 1}
        strokeOpacity="0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter={!simplified ? `url(#glow-${colorScheme})` : undefined}
      />

      {/* Inner beaker shadow for depth */}
      {!simplified && (
        <path
          d="M40 22 L40 44 L20 81 Q18 85 23 85 L77 85 Q82 85 80 81 L60 44 L60 22 Z"
          fill="none"
          stroke="black"
          strokeWidth="0.5"
          strokeOpacity="0.12"
          strokeLinejoin="round"
        />
      )}

      {/* Glass refraction streak */}
      {!simplified && (
        <path
          d="M42 25 L42 80"
          fill="none"
          stroke={`url(#glassRefraction-${colorScheme})`}
          strokeWidth="8"
          strokeOpacity="0.5"
          strokeLinecap="round"
        />
      )}

      {/* Primary fluid layer with animation */}
      <motion.path
        initial={{ d: "M40 48 L25 80 Q23 83 27 83 L73 83 Q77 83 75 80 L60 48 Q58 45 50 45 Q42 45 40 48 Z" }}
        animate={{
          d: [
            "M40 48 L25 80 Q23 83 27 83 L73 83 Q77 83 75 80 L60 48 Q58 45 50 45 Q42 45 40 48 Z",
            "M40 51 L25 83 Q23 86 27 86 L73 86 Q77 86 75 83 L60 51 Q58 48 50 48 Q42 48 40 51 Z",
            "M40 48 L25 80 Q23 83 27 83 L73 83 Q77 83 75 80 L60 48 Q58 45 50 45 Q42 45 40 48 Z",
          ],
        }}
        transition={fluidTransition}
        fill={`url(#beakerFluid-${colorScheme})`}
        filter={`url(#glowFluid-${colorScheme})`}
      />

      {/* Secondary fluid layer */}
      {!simplified && (
        <motion.path
          initial={{ d: "M41 49 L26 81 Q24 84 28 84 L72 84 Q76 84 74 81 L59 49 Q57 46 50 46 Q43 46 41 49 Z" }}
          animate={{
            d: [
              "M41 49 L26 81 Q24 84 28 84 L72 84 Q76 84 74 81 L59 49 Q57 46 50 46 Q43 46 41 49 Z",
              "M41 51 L26 83 Q24 86 28 86 L72 86 Q76 86 74 83 L59 51 Q57 48 50 48 Q43 48 41 51 Z",
              "M41 49 L26 81 Q24 84 28 84 L72 84 Q76 84 74 81 L59 49 Q57 46 50 46 Q43 46 41 49 Z",
            ],
          }}
          transition={{ duration: fluidDuration + 1, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
          fill={`url(#beakerFluid2-${colorScheme})`}
          opacity="0.4"
          filter={`url(#glowFluid-${colorScheme})`}
        />
      )}

      {/* Surface tension meniscus — softened to blend into fluid */}
      <motion.path
        initial={{ d: "M25 80 Q50 85 75 80" }}
        fill="none"
        stroke={`url(#beakerFluid-${colorScheme})`}
        strokeWidth={simplified ? 1 : 2}
        strokeOpacity={simplified ? 0.4 : 0.5}
        strokeLinecap="round"
        filter={!simplified ? `url(#meniscusBlur-${colorScheme})` : undefined}
        animate={{ d: ["M25 80 Q50 85 75 80", "M25 81 Q50 86 75 81", "M25 80 Q50 85 75 80"] }}
        transition={{ duration: fluidDuration, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Bubble particles */}
      {animated && (
        <g>
          {Array.from({ length: bubbleCount }).map((_, i) => (
            <motion.circle
              key={i}
              cx={38 + i * 11}
              r={0.9 - i * 0.1}
              fill={i === 3 ? colors.primary : 'white'}
              fillOpacity={0.6 - i * 0.1}
              initial={{
                cy: 75 - i * 2,
                opacity: 0.6 - i * 0.1,
              }}
              animate={{
                cy: [75 - i * 2, 58 - i * 3, 48 - i * 2],
                opacity: [0.6 - i * 0.1, 0.3 - i * 0.1, 0],
              }}
              transition={{
                duration: 3.8 + i * 0.4,
                repeat: Infinity,
                ease: "easeOut",
                delay: i * 0.7,
              }}
            />
          ))}
        </g>
      )}

      {/* Sparkle particles */}
      {showSparkles && animated && (
        <g>
          <motion.circle cx="40" cy="65" r="0.5" fill="white" fillOpacity="0.8"
            animate={{ opacity: [0, 0.8, 0], scale: [0.8, 1.2, 0.8] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
          />
          <motion.circle cx="55" cy="70" r="0.4" fill="white" fillOpacity="0.7"
            animate={{ opacity: [0, 0.7, 0], scale: [0.7, 1.1, 0.7] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
          />
          <motion.circle cx="48" cy="60" r="0.6" fill="white" fillOpacity="0.6"
            animate={{ opacity: [0, 0.6, 0], scale: [0.6, 1, 0.6] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut", delay: 1.8 }}
          />
          <motion.circle cx="65" cy="68" r="0.5" fill={colors.accent} fillOpacity="0.8"
            animate={{ opacity: [0, 0.8, 0], scale: [0.8, 1.2, 0.8] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: 2.5 }}
          />
        </g>
      )}

      {/* Clean rim at top */}
      <ellipse
        cx="50"
        cy="20"
        rx="16"
        ry={simplified ? 1.5 : 2}
        fill="none"
        stroke="white"
        strokeWidth={simplified ? 0.8 : 1}
        strokeOpacity="0.35"
      />

      {/* Text integration for hero variant */}
      {variant === 'hero' && !simplified && animated && (
        <motion.g
          animate={{ y: [0, 1, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        >
          {/* Main SOLVENT text */}
          <text x="50" y="65" textAnchor="middle" fill="white" fontSize="5.5" fontWeight="900"
            style={{
              fontFamily: 'Inter Tight, sans-serif',
              letterSpacing: '0.18em',
              filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.5)) drop-shadow(0 0 20px rgba(157,91,210,0.4))'
            }}>
            SOLVENT
          </text>

          {/* Chromatic aberration layers */}
          <text x="50.3" y="65" textAnchor="middle" fill={colors.accent} fontSize="5.5" fontWeight="900" opacity="0.15"
            style={{ fontFamily: 'Inter Tight, sans-serif', letterSpacing: '0.18em' }}>
            SOLVENT
          </text>
          <text x="49.7" y="65" textAnchor="middle" fill={colors.primary} fontSize="5.5" fontWeight="900" opacity="0.15"
            style={{ fontFamily: 'Inter Tight, sans-serif', letterSpacing: '0.18em' }}>
            SOLVENT
          </text>

          {/* Subtitle */}
          <text x="50" y="71.5" textAnchor="middle" fill="white" fillOpacity="0.5" fontSize="1.9" fontWeight="900"
            style={{
              fontFamily: 'Inter Tight, sans-serif',
              letterSpacing: '0.28em',
              filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.3))'
            }}>
            BY KAUSTIKSOLUTIONS
          </text>
        </motion.g>
      )}
    </>
  );

  // Render based on variant
  if (variant === 'text') {
    return (
      <div
        className={cn('flex items-center justify-center', className)}
        style={{ opacity }}
        onClick={onClick}
        role="img"
        aria-label={ariaLabel}
      >
        <span
          className="font-black tracking-[0.35em] text-white uppercase"
          style={{
            fontSize: pixelSize * 0.15,
            filter: 'drop-shadow(0 0 15px rgba(60, 113, 247, 0.4))',
          }}
        >
          Solvent AI
        </span>
      </div>
    );
  }

  if (variant === 'combined') {
    return (
      <div
        className={cn('flex items-center gap-3', className)}
        style={{ opacity }}
        onClick={onClick}
        role="img"
        aria-label={ariaLabel}
      >
        <div style={{ width: pixelSize * 0.5, height: pixelSize * 0.5 }}>
          <svg viewBox="0 0 100 100" className="w-full h-full">
            {renderBeakerContent()}
          </svg>
        </div>
        <span
          className="font-black tracking-[0.35em] text-white uppercase"
          style={{
            fontSize: pixelSize * 0.15,
            filter: 'drop-shadow(0 0 15px rgba(60, 113, 247, 0.4))',
          }}
        >
          Solvent AI
        </span>
      </div>
    );
  }

  // Default: beaker/icon/minimal variants all render the beaker
  return (
    <svg
      viewBox="0 0 100 100"
      className={cn('w-full h-full', className)}
      style={{
        opacity,
        filter: variant === 'hero' ? 'drop-shadow(0 0 60px rgba(157,91,210,0.6))' : undefined,
        ...(isInteractive ? { cursor: 'pointer' } : {}),
      }}
      role="img"
      aria-label={ariaLabel}
      onClick={onClick}
    >
      {renderBeakerContent()}
    </svg>
  );
});

Logo.displayName = 'Logo';

export { Logo };
