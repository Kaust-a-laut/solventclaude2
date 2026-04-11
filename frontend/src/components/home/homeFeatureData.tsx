import React from 'react';
import {
  FlaskConical, Code, Brain, MessageSquare,
  ScanEye, Globe, Terminal
} from 'lucide-react';
import { MissionControlPreview } from '../MissionControlPreview';

export type FeatureItem = {
  id: string;
  title: string;
  desc: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
  span?: string;
  badge?: string;
  hoverBorder: string;
  badgeColor?: string;
  actionText?: string;
  preview?: React.ReactNode;
};

export const HOME_FEATURES: FeatureItem[] = [
  {
    id: 'waterfall',
    title: 'Waterfall Architect',
    desc: 'Autonomous multi-model reasoning pipeline. Collapses complex projects into 3-stage verified execution.',
    icon: FlaskConical,
    color: 'text-jb-purple',
    bg: 'bg-jb-purple/5',
    border: 'border-jb-purple/10',
    span: 'lg:col-span-2',
    badge: 'Core',
    hoverBorder: 'group-hover:border-jb-purple/30',
    badgeColor: 'bg-jb-purple/10 border border-jb-purple/20 text-jb-purple/80',
  },
  {
    id: 'command_center',
    title: 'Take control with the Solvent Command Center',
    desc: 'Deep-integrated persistent context and data storage. Detach your mission directives into a PiP window to maintain autonomous oversight across your entire OS and other applications.',
    icon: Terminal,
    color: 'text-jb-purple',
    bg: 'bg-jb-purple/5',
    border: 'border-jb-purple/10',
    span: 'lg:row-span-2',
    preview: <MissionControlPreview />,
    actionText: 'Launch Mission Control',
    hoverBorder: 'group-hover:border-jb-purple/30',
  },
  {
    id: 'coding',
    title: 'Agentic IDE',
    desc: 'Next-gen coding workspace with autonomous agents, real-time refactoring, and terminal integration.',
    icon: Code,
    color: 'text-jb-accent',
    bg: 'bg-jb-accent/5',
    border: 'border-jb-accent/10',
    span: 'lg:col-span-1',
    hoverBorder: 'group-hover:border-jb-accent/30',
  },
  {
    id: 'vision',
    title: 'SolventSee Lab',
    desc: 'High-fidelity vision & media forge. Analyze UI, generate assets, and edit imagery with precision.',
    icon: ScanEye,
    color: 'text-jb-orange',
    bg: 'bg-jb-orange/5',
    border: 'border-jb-orange/10',
    actionText: 'Dive into the SolventSee Lab',
    hoverBorder: 'group-hover:border-jb-orange/30',
  },
  {
    id: 'browser',
    title: 'Universal Browser',
    desc: 'AI-native web experience. Browse, scrape, and extract intelligence without leaving the interface.',
    icon: Globe,
    color: 'text-jb-cyan',
    bg: 'bg-jb-cyan/5',
    border: 'border-jb-cyan/10',
    hoverBorder: 'group-hover:border-jb-cyan/30',
  },
  {
    id: 'model_playground',
    title: 'Model Playground',
    desc: 'Harness GPT, Gemini, and Ollama in a unified sandbox. High-fidelity reasoning with zero switching friction.',
    icon: MessageSquare,
    color: 'text-jb-cyan',
    bg: 'bg-jb-cyan/5',
    border: 'border-jb-cyan/10',
    hoverBorder: 'group-hover:border-jb-cyan/30',
  },
  {
    id: 'memory',
    title: 'Project Memory',
    desc: 'Semantic vector knowledge base. Search, inspect, and manage what Solvent remembers about your project — crystallized insights, episodic context, and meta-summaries.',
    icon: Brain,
    color: 'text-jb-purple',
    bg: 'bg-jb-purple/5',
    border: 'border-jb-purple/10',
    actionText: 'Explore Memory',
    hoverBorder: 'group-hover:border-jb-purple/30',
  },
];
