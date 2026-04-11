import React from 'react';
import { motion } from 'framer-motion';
import { IntelPanel } from '../IntelPanel';

export const PipIntelView: React.FC = () => (
  <motion.div
    key="intel"
    initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
    className="flex-1 flex flex-col overflow-hidden"
  >
    <IntelPanel />
  </motion.div>
);
