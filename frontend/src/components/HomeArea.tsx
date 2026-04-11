import React from 'react';
import { motion } from 'framer-motion';
import { FlaskConical, ArrowRight, Github } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { BentoCard } from './BentoGrid';
import { Logo } from './Logo';
import { HOME_FEATURES } from './home/homeFeatureData';
import { HOME_SHOWCASE } from './home/homeShowcaseData';

export const HomeArea = () => {
  const { setCurrentMode, setIsCommandCenterOpen, setSettingsOpen, setSettingsInitialTab } = useAppStore();


  return (
    <div className="flex-1 min-h-0 relative bg-transparent z-10">
      <div className="absolute inset-0 overflow-y-scroll scrollbar-thin fluid-scrollbar p-6 md:p-10 lg:p-12 pt-2 md:pt-4 lg:pt-6">
      <div className="max-w-[1400px] mx-auto space-y-4 md:space-y-6 relative">
        
        {/* Massive Background Beaker Logo - Using new Logo component */}
        <div className="absolute -top-60 -left-60 w-[600px] h-[600px] md:w-[1000px] md:h-[1000px] opacity-[0.03] pointer-events-none blur-3xl overflow-hidden">
           <svg viewBox="0 0 100 100" className="w-full h-full fill-white">
              <path d="M38 20 L38 45 L18 82 Q15 88 22 88 L78 88 Q85 88 82 82 L62 45 L62 20 Z" />
           </svg>
        </div>

        {/* Hero Header — beaker left, text inset into its right edge */}
        <div className="relative z-10">

          <div className="flex flex-col md:flex-row items-center">

            {/* Beaker — left column */}
            <div className="shrink-0 w-full md:w-[45%] flex justify-center md:justify-start pointer-events-none mb-4 md:mb-0">
              <motion.div
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', damping: 20, stiffness: 80, delay: 0.4 }}
                className="w-[200px] h-[200px] md:w-full md:h-auto md:aspect-square relative opacity-[0.18] md:opacity-[0.28]"
              >
                {/* Enhanced ambient glow layers */}
                <div className="absolute inset-x-16 inset-y-8 bg-jb-purple/25 blur-[80px] rounded-full animate-pulse" />
                <div className="absolute inset-x-24 inset-y-16 bg-jb-orange/15 blur-[60px] rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
                <div className="absolute inset-x-20 inset-y-12 bg-jb-accent/10 blur-[70px] rounded-full animate-pulse" style={{ animationDelay: '0.5s' }} />

                <Logo size="xl" variant="hero" animated={true} />
              </motion.div>
            </div>

            {/* Text column — heading + paragraph (z-20 lifts above beaker glow) */}
            <div className="md:flex-1 flex flex-col gap-4 md:gap-6 relative z-20">

              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="relative z-10 font-black text-white tracking-tighter leading-[1.05] text-center md:text-left"
                style={{ fontSize: 'clamp(2rem, 4.5vw + 0.5rem, 5.5rem)' }}
              >
                The Multitool <span className="text-vibrant">AI OS</span> for{' '}
                <span className="text-vibrant">Engineering</span> Physical{' '}
                <span className="text-vibrant">Reality</span>.
              </motion.h2>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="vibrant-border relative max-w-3xl rounded-2xl mx-auto md:mx-0"
              >
                <div className="relative rounded-2xl bg-[#020205] px-8 py-5">
                  <p className="text-center md:text-left text-white/75 text-base md:text-lg font-medium leading-relaxed tracking-tight">
                    A consolidated digital workspace designed to bridge the gap between intelligence and execution. From autonomous code to physical outcomes, one interface for everything.
                  </p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 }}
                className="flex justify-center md:justify-start"
              >
                <button
                  onClick={() => setCurrentMode('chat')}
                  className="flex items-center gap-2.5 px-7 py-3 text-sm font-black uppercase tracking-wider text-white rounded-full bg-gradient-to-r from-jb-purple to-jb-accent shadow-[0_0_20px_rgba(157,91,210,0.35)] hover:shadow-[0_0_30px_rgba(157,91,210,0.55)] transition-all"
                >
                  Get Started <ArrowRight size={16} />
                </button>
              </motion.div>

            </div>

          </div>

        </div>

        <div className="fluid-divider rounded-full my-2" />

        {/* Bento Grid - Enhanced scaling */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 grid-flow-dense gap-4 md:gap-6">
           {HOME_FEATURES.map((feature, idx) => (
             <BentoCard
               key={feature.id}
               {...feature}
               onClick={() => {
                 if (feature.id === 'command_center') {
                   setIsCommandCenterOpen(true);
                 } else if (feature.id === 'memory') {
                   setSettingsInitialTab('memory');
                   setSettingsOpen(true);
                 } else {
                   setCurrentMode(feature.id as 'chat' | 'coding' | 'browse' | 'image' | 'waterfall' | 'debate' | 'compare' | 'collaborate' | 'solvent-see' | 'playground');
                 }
               }}
               delay={idx * 0.1}
             />
           ))}
        </div>

        {/* Mode Showcase Strip */}
        <div className="border-t border-white/[0.06] pt-16 md:pt-24 space-y-24 md:space-y-32 pb-16">
          <div className="text-center space-y-2">
            <p className="text-[11px] font-black uppercase tracking-[0.35em] text-white/20">Explore the suite</p>
            <h2 className="text-2xl md:text-3xl font-black text-white/60 tracking-tight">Every tool. One surface.</h2>
          </div>

          {HOME_SHOWCASE.map((item, idx) => {
            const Icon = item.icon;
            const isReversed = idx % 2 === 1;
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className={`flex flex-col lg:flex-row gap-10 lg:gap-16 xl:gap-24 items-center ${isReversed ? 'lg:flex-row-reverse' : ''}`}
              >
                {/* Visual panel */}
                <div className="w-full lg:w-1/2 shrink-0">
                  <div
                    className={`relative rounded-3xl border overflow-hidden ${item.bg} ${item.border}`}
                    style={{ aspectRatio: '16/10' }}
                  >
                    {/* Dot grid */}
                    <div className="absolute inset-0 opacity-[0.035]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
                    {/* Glow orb */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-64 h-64 rounded-full blur-[80px] opacity-20" style={{ background: item.accentColor }} />
                    </div>
                    {/* Large faint icon */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <Icon size={120} className={item.color} style={{ opacity: 0.07 }} strokeWidth={0.75} />
                    </div>
                    {/* HUD corner lines */}
                    <div className="absolute top-0 left-0 w-12 h-px bg-white/[0.06]" />
                    <div className="absolute top-0 left-0 w-px h-12 bg-white/[0.06]" />
                    <div className="absolute bottom-0 right-0 w-12 h-px bg-white/[0.06]" />
                    <div className="absolute bottom-0 right-0 w-px h-12 bg-white/[0.06]" />
                    {/* Tag */}
                    <div className="absolute top-4 left-4 text-[11px] font-black uppercase tracking-[0.25em] font-mono opacity-40" style={{ color: item.accentColor }}>
                      {item.tag}
                    </div>
                    {/* Mode-specific decoration */}
                    {item.visual}
                  </div>
                </div>

                {/* Text panel */}
                <div className="w-full lg:w-1/2 space-y-5">
                  <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center ${item.bg} ${item.border}`}>
                    <Icon size={20} className={item.color} />
                  </div>
                  <div className="space-y-2">
                    <p className="text-[11px] font-black uppercase tracking-[0.3em] text-white/20">{item.category}</p>
                    <h3 className="text-3xl lg:text-4xl xl:text-[2.75rem] font-black text-white tracking-tighter leading-[1.05]">{item.title}</h3>
                  </div>
                  <p className="text-white/45 text-base lg:text-[17px] leading-relaxed">{item.desc}</p>
                  <ul className="space-y-2.5">
                    {item.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-3 text-sm text-white/35">
                        <span className="w-1.5 h-1.5 rounded-full mt-[5px] shrink-0" style={{ background: item.accentColor, opacity: 0.7 }} />
                        {b}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => {
                      if (item.id === 'command_center') setIsCommandCenterOpen(true);
                      else setCurrentMode(item.mode);
                    }}
                    className={`mt-2 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold border transition-all hover:gap-3 ${item.bg} ${item.border} ${item.color} hover:opacity-80`}
                  >
                    {item.actionText}
                    <ArrowRight size={14} />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Footer */}
        <footer className="mt-16 border-t border-white/[0.06] py-12">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/30">
            <div className="flex items-center gap-2">
              <FlaskConical size={14} className="text-jb-purple/60" />
              <span>&copy; {new Date().getFullYear()} Solvent AI &mdash; Intelligence meets execution</span>
            </div>
            <a
              href="https://github.com/Kaust-a-laut/Solvent-Claude"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-white/30 hover:text-white/60 transition-colors"
            >
              <Github size={14} />
              <span>GitHub</span>
            </a>
          </div>
        </footer>
      </div>
      </div>{/* close absolute inset-0 scroll container */}
    </div>
  );
};
