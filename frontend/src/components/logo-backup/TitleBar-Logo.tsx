/**
 * ORIGINAL TITLEBAR LOGO - BACKUP
 * Created: March 13, 2026
 * 
 * This is the original logo implementation from TitleBar.tsx
 * Before the comprehensive redesign and component extraction
 */

import React from 'react';
import { motion } from 'framer-motion';

export const OriginalTitleBarLogo = () => {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_20px_rgba(251,146,60,0.6)]">
      <defs>
        {/* Primary fluid gradient */}
        <linearGradient id="beakerFluidTitle" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FB923C" />
          <stop offset="50%" stopColor="#F43F5E" />
          <stop offset="100%" stopColor="#9D5BD2" />
        </linearGradient>

        {/* Rim highlight gradient */}
        <linearGradient id="rimHighlightTitle" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="white" stopOpacity="0.8" />
          <stop offset="50%" stopColor="white" stopOpacity="0.3" />
          <stop offset="100%" stopColor="white" stopOpacity="0.6" />
        </linearGradient>

        <filter id="glowTitle">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Enhanced beaker outline - vertical walls, no top horizontal line */}
      <path
        d="M38 22 L38 45 L18 82 Q15 88 22 88 L78 88 Q85 88 82 82 L62 45 L62 22"
        fill="none"
        stroke="white"
        strokeWidth="1"
        strokeOpacity="0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Primary fluid layer */}
      <motion.path
        animate={{
          d: [
            "M40 48 L25 80 Q23 83 27 83 L73 83 Q77 83 75 80 L60 48 Q58 45 50 45 Q42 45 40 48 Z",
            "M40 50 L25 82 Q23 85 27 85 L73 85 Q77 85 75 82 L60 50 Q58 47 50 47 Q42 47 40 50 Z",
            "M40 48 L25 80 Q23 83 27 83 L73 83 Q77 83 75 80 L60 48 Q58 45 50 45 Q42 45 40 48 Z",
          ],
        }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        fill="url(#beakerFluidTitle)"
        fillOpacity="0.95"
        filter="url(#glowTitle)"
      />

      {/* Surface tension line - synced with fluid layer */}
      <motion.path
        d="M25 80 Q50 84 75 80"
        fill="none"
        stroke="white"
        strokeWidth="1"
        strokeOpacity="0.6"
        strokeLinecap="round"
        animate={{
          d: [
            "M25 80 Q50 84 75 80",
            "M25 81 Q50 85 75 81",
            "M25 80 Q50 84 75 80",
          ],
        }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Small bubbles - contained within beaker */}
      <motion.circle
        cx="42"
        cy="72"
        r="0.7"
        fill="white"
        fillOpacity="0.5"
        animate={{ cy: [72, 58, 48], opacity: [0.5, 0.3, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeOut" }}
      />
      <motion.circle
        cx="55"
        cy="70"
        r="0.5"
        fill="white"
        fillOpacity="0.4"
        animate={{ cy: [70, 56, 46], opacity: [0.4, 0.2, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeOut", delay: 0.5 }}
      />

      {/* Clean rim at top - subtle open ellipse, no glow */}
      <ellipse
        cx="50"
        cy="20"
        rx="16"
        ry="2"
        fill="none"
        stroke="white"
        strokeWidth="0.8"
        strokeOpacity="0.35"
      />
    </svg>
  );
};
