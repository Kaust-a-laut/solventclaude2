import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';
import { Target } from 'lucide-react';

interface BentoGridProps {
  children: React.ReactNode;
  className?: string;
}

export const BentoGrid = ({ children, className }: BentoGridProps) => (
  <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6", className)}>
    {children}
  </div>
);

interface BentoCardProps {
  id?: string;
  title: string;
  desc: string;
  icon: React.ElementType;
  color?: string;
  bg?: string;
  border?: string;
  span?: string;
  badge?: string;
  onClick?: () => void;
  actionText?: string;
  delay?: number;
  image?: string;
  preview?: React.ReactNode;
  className?: string;
  hoverBorder?: string;
  badgeColor?: string;
}

export const BentoCard = ({
  id,
  title,
  desc,
  icon: Icon,
  color = 'text-jb-accent',
  bg = 'bg-white/[0.02]',
  border = 'border-white/[0.05]',
  span = '',
  badge,
  onClick,
  actionText = 'Initiate Protocol',
  delay = 0,
  image,
  preview,
  className,
  hoverBorder = 'group-hover:border-white/20',
  badgeColor,
}: BentoCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.5 }}
      whileHover={{ y: -5 }}
      onClick={onClick}
      className={cn(
        "group relative p-6 md:p-8 lg:p-10 rounded-[2.5rem] border transition-all duration-500 cursor-pointer overflow-hidden glass-panel button-glow-hover flex flex-col justify-between",
        preview ? "min-h-[260px]" : "w-full",
        bg, border, span, className, hoverBorder
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.05] via-transparent to-white/[0.01] opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
      
      {/* HUD Lines from v1.1 */}
      <div className="absolute top-0 right-0 w-24 h-[1px] bg-white/[0.05] group-hover:bg-white/15 transition-colors" />
      <div className="absolute top-0 right-0 w-[1px] h-24 bg-white/[0.05] group-hover:bg-white/15 transition-colors" />

      <div className="relative z-10 space-y-6 flex-1 flex flex-col">
        <div className="flex justify-between items-start">
          <div className={cn("p-4 rounded-2xl bg-black/40 border border-white/[0.05] shadow-2xl transition-all duration-500 group-hover:scale-110 group-hover:border-white/10", color)}>
            <Icon size={26} strokeWidth={1.5} />
          </div>
          {badge && (
            <span className={cn(
              "px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] backdrop-blur-md",
              badgeColor ?? "bg-black/40 text-white/60 border border-white/10"
            )}>
              {badge}
            </span>
          )}
        </div>
        
        <div className="space-y-4 flex-1 flex flex-col">
          <div className="space-y-2">
            <h3 className="text-2xl md:text-3xl font-black text-white tracking-tighter transition-all group-hover:text-vibrant">{title}</h3>
            <p className="text-base md:text-lg text-slate-400 font-medium leading-[1.6]">
              {desc}
            </p>
          </div>

          {preview && (
            <div className="mt-4 relative overflow-hidden rounded-2xl border border-white/5 bg-black/20 flex-1 min-h-[200px]">
              {preview}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
            </div>
          )}

          {image && !preview && (
            <div className="relative mt-4 rounded-xl overflow-hidden border border-white/5 group-hover:border-white/10 transition-colors shadow-2xl">
               <img 
                 src={image} 
                 alt={title} 
                 className="w-full h-48 object-cover opacity-60 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700" 
               />
               <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
            </div>
          )}
        </div>
      </div>
      
      <div className="relative z-10 pt-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-white/40 group-hover:text-white transition-all">
        {actionText.startsWith('Dive') ? (
          <div className="flex flex-col items-center w-full gap-1">
            <div className="flex items-center justify-center w-full gap-[0.5em]">
              <span className="group-hover:text-vibrant transition-colors duration-500">Dive</span>
              <span>into</span>
              <span>the</span>
            </div>
            <span className="text-center">{actionText.substring(13).trim()}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {actionText}
          </div>
        )} 
        <Target size={14} className="group-hover:translate-x-1 group-hover:rotate-45 transition-transform text-white/20 group-hover:text-white shrink-0" />
      </div>
    </motion.div>
  );
};

export const BentoItem = ({ children, title, className, delay = 0 }: { children: React.ReactNode, title?: string, className?: string, delay?: number }) => (
  <div className={cn("bg-black/40 backdrop-blur-xl p-6 rounded-3xl border border-white/5 shadow-2xl relative overflow-hidden", className)}>
    <div className="absolute -right-10 -top-10 w-24 h-24 bg-white/5 rounded-full blur-3xl pointer-events-none" />
    {title && <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] mb-4 opacity-60">{title}</h3>}
    {children}
  </div>
);