import React from 'react';
import { motion } from 'framer-motion';
import { WaterfallVisualizer } from '../WaterfallVisualizer';

export const PipWaterfallView: React.FC = () => (
  <motion.div
    key="waterfall"
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    className="flex-1 flex flex-col overflow-y-auto no-scrollbar"
  >
    <div className="p-4"><WaterfallVisualizer /></div>
  </motion.div>
);
