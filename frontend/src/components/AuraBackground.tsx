import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store/useAppStore';

const AuraBackground: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { auraMode } = useAppStore();

  return (
    <div className="relative h-full w-full flex flex-col bg-[#020205] overflow-hidden text-jb-text">
      <style>{`
        @keyframes aura-organic-pulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.1); }
        }
        .aura-mesh-container {
          position: absolute;
          inset: -50%;
          width: 200%;
          height: 200%;
          background-image: 
            radial-gradient(circle at 35% 50%, rgba(60, 113, 247, 0.15) 0%, transparent 50%),
            radial-gradient(circle at 65% 50%, rgba(157, 91, 210, 0.15) 0%, transparent 50%),
            radial-gradient(circle at 40% 40%, rgba(251, 146, 60, 0.1) 0%, transparent 50%);
          background-blend-mode: screen;
          filter: blur(100px);
          animation: aura-organic-pulse 12s infinite ease-in-out;
          will-change: opacity, transform;
          transform: translate3d(0,0,0);
          pointer-events: none;
        }
        .noise-overlay {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          opacity: 0.03;
          pointer-events: none;
          z-index: 1;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
        }
      `}</style>
      
      <div className="noise-overlay" />
      
      {/* ORGANIC AURA: Optimized Mesh Synthesis */}
      <AnimatePresence>
        {auraMode === 'organic' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none"
          >
            <div className="aura-mesh-container" />
            <motion.div 
               animate={{ 
                 x: [0, 100, 0],
                 y: [0, -50, 0],
                 opacity: [0.1, 0.2, 0.1]
               }}
               transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
               className="absolute top-1/3 left-1/3 w-[50%] h-[50%] rounded-full bg-jb-accent/5 blur-[120px] will-change-transform"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* STATIC AURA: Deep Space Glow */}
      <AnimatePresence>
        {auraMode === 'static' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none"
          >
            <div 
              className="absolute top-[-10%] left-[-10%] w-[80%] h-[80%] rounded-full opacity-20 blur-[150px]"
              style={{ background: 'radial-gradient(circle, #3C71F7 0%, transparent 70%)' }}
            />
            <div 
              className="absolute bottom-[-10%] right-[-10%] w-[80%] h-[80%] rounded-full opacity-20 blur-[150px]"
              style={{ background: 'radial-gradient(circle, #9D5BD2 0%, transparent 70%)' }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* OFF MODE: Deep Void */}
      {auraMode === 'off' && (
        <div className="absolute inset-0 bg-[#020205]" />
      )}

      <div className="relative z-10 w-full flex-1 min-h-0 flex flex-col">
        {children}
      </div>
    </div>
  );
};

export default AuraBackground;