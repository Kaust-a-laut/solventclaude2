/**
 * ORIGINAL HOMEAREA HERO LOGO - BACKUP
 * Created: March 13, 2026
 * 
 * This is the original logo implementation from HomeArea.tsx
 * Before the comprehensive redesign and component extraction
 * 
 * Usage: Large background logo (600-1000px) and hero display (200px)
 */

import React from 'react';
import { motion } from 'framer-motion';

export const OriginalHomeAreaLogo = () => {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_60px_rgba(157,91,210,0.6)] relative z-10">
      <defs>
        {/* Primary fluid gradient */}
        <linearGradient id="beakerFluidLarge" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FB923C">
            <animate attributeName="stop-color" values="#FB923C;#F43F5E;#FB923C" dur="10s" repeatCount="indefinite" />
          </stop>
          <stop offset="40%" stopColor="#F43F5E">
            <animate attributeName="stop-color" values="#F43F5E;#9D5BD2;#F43F5E" dur="10s" repeatCount="indefinite" />
          </stop>
          <stop offset="70%" stopColor="#9D5BD2">
            <animate attributeName="stop-color" values="#9D5BD2;#3C71F7;#9D5BD2" dur="10s" repeatCount="indefinite" />
          </stop>
          <stop offset="100%" stopColor="#3C71F7">
            <animate attributeName="stop-color" values="#3C71F7;#06B6D4;#3C71F7" dur="10s" repeatCount="indefinite" />
          </stop>
        </linearGradient>

        {/* Secondary fluid layer gradient - more transparent */}
        <linearGradient id="beakerFluidLarge2" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FB923C" stopOpacity="0.6" />
          <stop offset="50%" stopColor="#9D5BD2" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#3C71F7" stopOpacity="0.6" />
        </linearGradient>

        {/* Rim highlight gradient */}
        <linearGradient id="rimHighlight" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="white" stopOpacity="0.8" />
          <stop offset="50%" stopColor="white" stopOpacity="0.3" />
          <stop offset="100%" stopColor="white" stopOpacity="0.6" />
        </linearGradient>

        {/* Glass refraction gradient */}
        <linearGradient id="glassRefraction" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="white" stopOpacity="0" />
          <stop offset="50%" stopColor="white" stopOpacity="0.08" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>

        <filter id="glowLarge" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>

        {/* Enhanced glow for fluid */}
        <filter id="glowFluid" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Neural network background pattern */}
      <g opacity="0.08">
        <motion.path
          d="M25 70 L35 60 L45 65 L55 55 L65 60 L75 50"
          fill="none"
          stroke="#9D5BD2"
          strokeWidth="0.5"
          strokeLinecap="round"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.path
          d="M30 75 L40 68 L50 72 L60 65 L70 70"
          fill="none"
          stroke="#3C71F7"
          strokeWidth="0.5"
          strokeLinecap="round"
          animate={{ opacity: [0.2, 0.5, 0.2] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
        />
        <motion.path
          d="M28 78 L38 73 L48 78 L58 73 L68 78"
          fill="none"
          stroke="#FB923C"
          strokeWidth="0.5"
          strokeLinecap="round"
          animate={{ opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />
        {/* Neural nodes */}
        <motion.circle cx="35" cy="60" r="1" fill="#9D5BD2" animate={{ opacity: [0.4, 0.8, 0.4] }} transition={{ duration: 3, repeat: Infinity }} />
        <motion.circle cx="55" cy="55" r="1" fill="#3C71F7" animate={{ opacity: [0.4, 0.8, 0.4] }} transition={{ duration: 3.5, repeat: Infinity, delay: 0.3 }} />
        <motion.circle cx="65" cy="60" r="1" fill="#FB923C" animate={{ opacity: [0.4, 0.8, 0.4] }} transition={{ duration: 4, repeat: Infinity, delay: 0.6 }} />
      </g>

      {/* Enhanced beaker outline - vertical walls, no top horizontal line */}
      <path
        d="M38 22 L38 45 L18 82 Q15 88 22 88 L78 88 Q85 88 82 82 L62 45 L62 22"
        fill="none"
        stroke="white"
        strokeWidth="1"
        strokeOpacity="0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#glowLarge)"
      />

      {/* Inner beaker shadow for depth */}
      <path
        d="M40 22 L40 44 L20 81 Q18 85 23 85 L77 85 Q82 85 80 81 L60 44 L60 22 Z"
        fill="none"
        stroke="black"
        strokeWidth="0.5"
        strokeOpacity="0.12"
        strokeLinejoin="round"
      />

      {/* Glass refraction streak */}
      <path
        d="M42 25 L42 80"
        fill="none"
        stroke="url(#glassRefraction)"
        strokeWidth="8"
        strokeOpacity="0.5"
        strokeLinecap="round"
      />

      {/* Primary fluid layer */}
      <motion.path
        animate={{
          d: [
            "M40 48 L25 80 Q23 83 27 83 L73 83 Q77 83 75 80 L60 48 Q58 45 50 45 Q42 45 40 48 Z",
            "M40 51 L25 83 Q23 86 27 86 L73 86 Q77 86 75 83 L60 51 Q58 48 50 48 Q42 48 40 51 Z",
            "M40 48 L25 80 Q23 83 27 83 L73 83 Q77 83 75 80 L60 48 Q58 45 50 45 Q42 45 40 48 Z",
          ],
        }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        fill="url(#beakerFluidLarge)"
        filter="url(#glowFluid)"
      />

      {/* Secondary fluid layer - subtle depth, blended edges */}
      <motion.path
        animate={{
          d: [
            "M41 49 L26 81 Q24 84 28 84 L72 84 Q76 84 74 81 L59 49 Q57 46 50 46 Q43 46 41 49 Z",
            "M41 51 L26 83 Q24 86 28 86 L72 86 Q76 86 74 83 L59 51 Q57 48 50 48 Q43 48 41 51 Z",
            "M41 49 L26 81 Q24 84 28 84 L72 84 Q76 84 74 81 L59 49 Q57 46 50 46 Q43 46 41 49 Z",
          ],
        }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
        fill="url(#beakerFluidLarge2)"
        opacity="0.4"
        filter="url(#glowFluid)"
      />

      {/* Surface tension meniscus effect - synced with top fluid layer */}
      <motion.path
        d="M25 80 Q50 85 75 80"
        fill="none"
        stroke="white"
        strokeWidth="1"
        strokeOpacity="0.6"
        strokeLinecap="round"
        animate={{ d: ["M25 80 Q50 85 75 80", "M25 81 Q50 86 75 81", "M25 80 Q50 85 75 80"] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Bubble particles rising - contained within beaker */}
      <g>
        <motion.circle cx="38" cy="75" r="1" fill="white" fillOpacity="0.6"
          animate={{ cy: [75, 58, 48], opacity: [0.6, 0.4, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeOut", delay: 0 }}
        />
        <motion.circle cx="50" cy="78" r="0.7" fill="white" fillOpacity="0.5"
          animate={{ cy: [78, 62, 50], opacity: [0.5, 0.3, 0] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeOut", delay: 0.8 }}
        />
        <motion.circle cx="60" cy="72" r="0.9" fill="white" fillOpacity="0.5"
          animate={{ cy: [72, 58, 48], opacity: [0.5, 0.3, 0] }}
          transition={{ duration: 3.8, repeat: Infinity, ease: "easeOut", delay: 1.5 }}
        />
        <motion.circle cx="44" cy="80" r="0.5" fill="#06B6D4" fillOpacity="0.7"
          animate={{ cy: [80, 64, 52], opacity: [0.7, 0.4, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeOut", delay: 2.2 }}
        />
        <motion.circle cx="55" cy="76" r="0.8" fill="white" fillOpacity="0.4"
          animate={{ cy: [76, 60, 49], opacity: [0.4, 0.2, 0] }}
          transition={{ duration: 4.2, repeat: Infinity, ease: "easeOut", delay: 3 }}
        />
      </g>

      {/* Sparkle particles within fluid */}
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
        <motion.circle cx="65" cy="68" r="0.5" fill="#FB923C" fillOpacity="0.8"
          animate={{ opacity: [0, 0.8, 0], scale: [0.8, 1.2, 0.8] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: 2.5 }}
        />
      </g>

      {/* Clean rim at top - subtle open ellipse, no glow */}
      <ellipse
        cx="50"
        cy="20"
        rx="16"
        ry="2"
        fill="none"
        stroke="white"
        strokeWidth="1"
        strokeOpacity="0.35"
      />

      {/* Text with subtle arc and chromatic effect */}
      <motion.g
        animate={{ y: [0, 1, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* Main SOLVENT text with enhanced glow */}
        <text x="50" y="65" textAnchor="middle" fill="white" fontSize="5.5" fontWeight="900"
          style={{
            fontFamily: 'Inter Tight, sans-serif',
            letterSpacing: '0.18em',
            filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.5)) drop-shadow(0 0 20px rgba(157,91,210,0.4))'
          }}>
          SOLVENT
        </text>

        {/* Subtle chromatic aberration layers */}
        <text x="50.3" y="65" textAnchor="middle" fill="#FB923C" fontSize="5.5" fontWeight="900" opacity="0.15"
          style={{ fontFamily: 'Inter Tight, sans-serif', letterSpacing: '0.18em' }}>
          SOLVENT
        </text>
        <text x="49.7" y="65" textAnchor="middle" fill="#3C71F7" fontSize="5.5" fontWeight="900" opacity="0.15"
          style={{ fontFamily: 'Inter Tight, sans-serif', letterSpacing: '0.18em' }}>
          SOLVENT
        </text>

        {/* Subtitle with refined styling */}
        <text x="50" y="71.5" textAnchor="middle" fill="white" fillOpacity="0.5" fontSize="1.9" fontWeight="900"
          style={{
            fontFamily: 'Inter Tight, sans-serif',
            letterSpacing: '0.28em',
            filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.3))'
          }}>
          BY KAUSTIKSOLUTIONS
        </text>
      </motion.g>
    </svg>
  );
};
