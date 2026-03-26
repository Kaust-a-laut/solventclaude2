import React, { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import { useAppStore } from '../../store/useAppStore';
import { STAGE_CONFIGS, type StageKey } from './WaterfallStageCard';
import {
  AlertCircle, FileCode, ListChecks, Lightbulb, ShieldAlert,
  CheckCircle2, XCircle, GitBranch, HelpCircle, Layers,
  Code, Download, Copy, Check,
} from 'lucide-react';

interface WaterfallDetailPanelProps {
  selectedStage: StageKey | null;
  steps: Record<StageKey, { status: string; data: any; error: string | null }>;
}

// ─── Data normalization ────────────────────────────────────────────────────
// Models sometimes return slightly different field names or the response
// comes back as { raw: "..." } when JSON parsing failed on the backend.
// Normalize once so the renderers can stay clean.

function normalizeData(data: any): any {
  if (!data) return null;
  // Backend returns { raw: "..." } when JSON parse fails
  if (data.raw && typeof data.raw === 'string') {
    try {
      const cleaned = data.raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
        .replace(/```json/g, '').replace(/```/g, '').trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
    } catch { /* fall through to raw display */ }
    return data;
  }
  return data;
}

/** SSE processing markers have { phase: 'architecting', message: '...' } — not real output */
const SSE_PHASES = ['architecting', 'reasoning', 'executing', 'reviewing', 'completed', 'retrying'];
function isProcessingMarker(data: any): boolean {
  if (!data || typeof data !== 'object') return false;
  return SSE_PHASES.includes(data.phase);
}

/** Check if data has any of the given keys with truthy values */
function hasAny(data: any, keys: string[]): boolean {
  return keys.some((k) => {
    const v = data[k];
    if (v == null) return false;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'string') return v.length > 0;
    return true;
  });
}

// ─── Architect output ──────────────────────────────────────────────────────

const ArchitectOutput = ({ data, textColor }: { data: any; textColor: string }) => {
  if (!data) return null;
  const d = normalizeData(data);

  // Raw string fallback
  if (d.raw && typeof d.raw === 'string') return <RawOutput text={d.raw} />;

  // Check if data has any known architect fields
  if (!hasAny(d, ['logic', 'keyDecisions', 'assumptions', 'techStack', 'complexity'])) {
    return <GenericOutput data={d} />;
  }

  return (
    <div className="space-y-5">
      {d.logic && (
        <Section label="Architecture Logic">
          <FormattedText text={d.logic} />
        </Section>
      )}
      {d.complexity && (
        <div className="flex items-center gap-2">
          <Label>Complexity</Label>
          <ComplexityBadge level={d.complexity} />
        </div>
      )}
      {d.keyDecisions?.length > 0 && (
        <Section label="Key Decisions">
          <NumberedList items={d.keyDecisions} color={textColor} />
        </Section>
      )}
      {d.assumptions?.length > 0 && (
        <Section label="Assumptions">
          <BulletList
            items={Array.isArray(d.assumptions) ? d.assumptions : [d.assumptions]}
            className="text-slate-500 italic"
          />
        </Section>
      )}
      {d.techStack?.length > 0 && (
        <Section label="Tech Stack">
          <ChipList items={d.techStack} />
        </Section>
      )}
    </div>
  );
};

// ─── Reasoner output ───────────────────────────────────────────────────────

const ReasonerOutput = ({ data, textColor }: { data: any; textColor: string }) => {
  if (!data) return null;
  const d = normalizeData(data);

  if (d.raw && typeof d.raw === 'string') return <RawOutput text={d.raw} />;
  if (!hasAny(d, ['plan', 'steps', 'carriedDecisions', 'openQuestions'])) {
    // Might be architect-like data (logic field) if reasoner returned similar shape
    if (hasAny(d, ['logic', 'keyDecisions'])) {
      return <ArchitectOutput data={d} textColor={textColor} />;
    }
    return <GenericOutput data={d} />;
  }

  return (
    <div className="space-y-5">
      {d.plan && (
        <Section label="Implementation Plan">
          <FormattedText text={d.plan} />
        </Section>
      )}
      {d.steps?.length > 0 && (
        <Section label={`Execution Steps (${d.steps.length})`}>
          <div className="space-y-3">
            {d.steps.map((s: any, i: number) => (
              <div key={i} className="flex items-start gap-3">
                <span className={cn(
                  'w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5',
                  'bg-jb-accent/10 text-jb-accent border border-jb-accent/20',
                )}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  {s.title && (
                    <strong className="text-[14px] text-slate-200 block mb-1">{s.title}</strong>
                  )}
                  <FormattedText text={s.description || (typeof s === 'string' ? s : JSON.stringify(s))} size="sm" />
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}
      {d.carriedDecisions?.length > 0 && (
        <Section label="Carried Decisions" icon={<GitBranch size={10} />}>
          <BulletList items={d.carriedDecisions} className="text-slate-400" icon={<CheckCircle2 size={9} className="text-emerald-500/60 mt-0.5 shrink-0" />} />
        </Section>
      )}
      {d.openQuestions?.length > 0 && (
        <Section label="Open Questions" icon={<HelpCircle size={10} />}>
          <BulletList items={d.openQuestions} className="text-amber-400/70" icon={<HelpCircle size={9} className="text-amber-400/50 mt-0.5 shrink-0" />} />
        </Section>
      )}
    </div>
  );
};

// ─── Copy button ──────────────────────────────────────────────────────────

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/[0.04] border border-white/10 text-slate-500 text-[9px] font-bold uppercase tracking-wider hover:bg-white/[0.08] hover:text-slate-300 transition-all"
    >
      {copied ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
};

// ─── Executor output ───────────────────────────────────────────────────────

const ExecutorOutput = ({ data }: { data: any }) => {
  if (!data) return null;
  const d = normalizeData(data);

  if (d.raw && typeof d.raw === 'string') return <RawOutput text={d.raw} />;
  if (!hasAny(d, ['code', 'explanation', 'files', 'decisionsOverridden'])) {
    return <GenericOutput data={d} />;
  }

  // Split code into file sections
  const codeBlocks = splitCodeByFiles(d.code);

  return (
    <div className="space-y-5">
      {d.explanation && (
        <Section label="Explanation">
          <FormattedText text={d.explanation} />
        </Section>
      )}
      {d.files?.length > 0 && (
        <Section label="Files" icon={<Layers size={10} />}>
          <div className="flex flex-wrap gap-1.5">
            {d.files.map((f: string, i: number) => (
              <span key={i} className="px-2.5 py-1 rounded-lg bg-jb-orange/10 border border-jb-orange/20 text-[13px] font-mono text-jb-orange/80 font-medium">
                {f}
              </span>
            ))}
          </div>
        </Section>
      )}
      {codeBlocks.length > 0 && (
        <Section label="Generated Code" icon={<FileCode size={10} />}>
          <div className="space-y-3">
            {codeBlocks.map((block, i) => (
              <div key={i} className="bg-black/60 border border-white/5 rounded-xl overflow-hidden">
                <div className="px-4 py-2 border-b border-white/5 bg-white/[0.02] flex items-center gap-2">
                  <FileCode size={11} className="text-slate-600" />
                  <span className="text-[12px] font-mono text-slate-400 font-medium flex-1">
                    {block.filename || 'output'}
                  </span>
                  <CopyButton text={block.code.trim()} />
                </div>
                <pre className="p-4 font-mono text-[14px] text-slate-300 overflow-x-auto scrollbar-thin leading-relaxed">
                  {block.code.trim()}
                </pre>
              </div>
            ))}
          </div>
        </Section>
      )}
      {d.decisionsOverridden?.length > 0 && (
        <Section label="Decisions Overridden">
          <BulletList items={d.decisionsOverridden} className="text-amber-400/70" icon={<XCircle size={9} className="text-amber-400/50 mt-0.5 shrink-0" />} />
        </Section>
      )}
    </div>
  );
};

// ─── Reviewer output ───────────────────────────────────────────────────────

const scoreColor = (score: number) => {
  if (score >= 90) return { text: 'text-emerald-400', bg: 'bg-emerald-500', ring: 'ring-emerald-500/30' };
  if (score >= 80) return { text: 'text-sky-400', bg: 'bg-sky-500', ring: 'ring-sky-500/30' };
  if (score >= 70) return { text: 'text-amber-400', bg: 'bg-amber-500', ring: 'ring-amber-500/30' };
  return { text: 'text-rose-400', bg: 'bg-rose-500', ring: 'ring-rose-500/30' };
};

const ReviewerOutput = ({ data }: { data: any }) => {
  if (!data) return null;
  const d = normalizeData(data);

  if (d.raw && typeof d.raw === 'string') return <RawOutput text={d.raw} />;
  if (!hasAny(d, ['score', 'summary', 'issues', 'breakdown', 'decisionsHonored', 'compilationStatus'])) {
    return <GenericOutput data={d} />;
  }

  const sc = d.score != null ? scoreColor(d.score) : null;

  return (
    <div className="space-y-5">
      {/* Score header */}
      {d.score != null && (
        <div className="flex items-center gap-4">
          <div className={cn('w-16 h-16 rounded-2xl flex items-center justify-center ring-2', sc!.ring, 'bg-white/[0.03]')}>
            <span className={cn('text-2xl font-black tabular-nums', sc!.text)}>{d.score}</span>
          </div>
          <div>
            <span className="text-[12px] font-black text-slate-500 uppercase tracking-widest block">Quality Score</span>
            {d.compilationStatus && (
              <span className={cn(
                'text-[11px] font-mono mt-1 block',
                d.compilationStatus.includes('Validated') ? 'text-emerald-400/60' : 'text-amber-400/60',
              )}>
                {d.compilationStatus}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Breakdown grid */}
      {d.breakdown && (
        <Section label="Score Breakdown" icon={<ShieldAlert size={10} />}>
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(d.breakdown).map(([key, val]) => (
              <div key={key} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-center">
                <div className="text-[18px] font-black text-white tabular-nums">{val as number}</div>
                <div className="text-[10px] font-black text-slate-600 uppercase tracking-wider mt-0.5">{key}</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {d.summary && (
        <Section label="Summary">
          <FormattedText text={d.summary} />
        </Section>
      )}

      {d.issues?.length > 0 && (
        <Section label={`Issues (${d.issues.length})`} icon={<ListChecks size={10} />}>
          <div className="space-y-2">
            {d.issues.map((issue: string, i: number) => (
              <div key={i} className="flex items-start gap-2.5 text-[14px] text-slate-400 leading-relaxed">
                <span className="w-2 h-2 rounded-full bg-rose-500/60 mt-1.5 shrink-0" />
                <span>{issue}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {d.decisionsHonored?.length > 0 && (
        <Section label="Decisions Honored">
          <div className="space-y-1.5">
            {d.decisionsHonored.map((dec: string, i: number) => (
              <div key={i} className="flex items-start gap-2.5 text-[14px] text-emerald-400/70 leading-relaxed">
                <CheckCircle2 size={11} className="text-emerald-500/50 mt-0.5 shrink-0" />
                <span>{dec}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {d.crystallizable_insight && (
        <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
          <Label icon={<Lightbulb size={10} className="text-emerald-400" />}>Crystallized Insight</Label>
          <p className="text-[14px] text-emerald-300/80 leading-relaxed mt-1">{d.crystallizable_insight}</p>
        </div>
      )}
    </div>
  );
};

// ─── Shared rendering components ───────────────────────────────────────────

const Label = ({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) => (
  <div className="flex items-center gap-1.5 mb-2">
    {icon && <span className="text-slate-600">{icon}</span>}
    <span className="text-[12px] font-black text-slate-600 uppercase tracking-widest">{children}</span>
  </div>
);

const Section = ({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) => (
  <div>
    <Label icon={icon}>{label}</Label>
    {children}
  </div>
);

/** Renders text with basic formatting — numbered sections, line breaks */
const FormattedText = ({ text, size = 'md' }: { text: string; size?: 'sm' | 'md' }) => {
  const textClass = size === 'sm' ? 'text-[14px]' : 'text-[15px]';
  // Split by numbered sections (e.g., "1. ", "2. " at start of line) or double newlines
  const paragraphs = text.split(/\n\n+/).filter(Boolean);

  if (paragraphs.length <= 1) {
    return <p className={cn(textClass, 'text-slate-300 leading-relaxed whitespace-pre-wrap')}>{text}</p>;
  }

  return (
    <div className="space-y-3">
      {paragraphs.map((p, i) => (
        <p key={i} className={cn(textClass, 'text-slate-300 leading-relaxed whitespace-pre-wrap')}>{p.trim()}</p>
      ))}
    </div>
  );
};

const NumberedList = ({ items, color }: { items: string[]; color: string }) => (
  <div className="space-y-2">
    {items.map((item, i) => (
      <div key={i} className="flex items-start gap-2.5 text-[14px] text-slate-400 leading-relaxed">
        <span className={cn('font-black shrink-0 mt-0.5 w-4 text-right', color)}>{i + 1}.</span>
        <span>{item}</span>
      </div>
    ))}
  </div>
);

const BulletList = ({ items, className, icon }: { items: string[]; className?: string; icon?: React.ReactNode }) => (
  <div className="space-y-1.5">
    {items.map((item, i) => (
      <div key={i} className={cn('flex items-start gap-2 text-[14px] leading-relaxed', className)}>
        {icon || <span className="text-slate-600 shrink-0 mt-0.5">•</span>}
        <span>{item}</span>
      </div>
    ))}
  </div>
);

const ChipList = ({ items }: { items: string[] }) => (
  <div className="flex flex-wrap gap-1.5">
    {items.map((t, i) => (
      <span key={i} className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[13px] font-mono text-slate-400">{t}</span>
    ))}
  </div>
);

const ComplexityBadge = ({ level }: { level: string }) => {
  const colors: Record<string, string> = {
    low: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    medium: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    high: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
  };
  return (
    <span className={cn('px-2 py-0.5 rounded-md border text-[11px] font-black uppercase', colors[level.toLowerCase()] ?? colors.medium)}>
      {level}
    </span>
  );
};

// ─── Code splitting ────────────────────────────────────────────────────────

interface CodeBlock {
  filename: string | null;
  code: string;
}

function splitCodeByFiles(code: string | undefined | null): CodeBlock[] {
  if (!code) return [];

  // Match file separators like: // ═══ src/foo.ts ═══  or  // --- src/foo.ts ---  or  // FILE: src/foo.ts
  const separatorRegex = /^\/\/\s*(?:═{3,}|─{3,}|-{3,}|FILE:)\s*(.+?)(?:\s*(?:═{3,}|─{3,}|-{3,}))?\s*$/gm;
  const matches = [...code.matchAll(separatorRegex)];

  if (matches.length === 0) {
    return [{ filename: null, code }];
  }

  const blocks: CodeBlock[] = [];
  for (let i = 0; i < matches.length; i++) {
    const filename = matches[i][1].trim();
    const start = matches[i].index! + matches[i][0].length;
    const end = i < matches.length - 1 ? matches[i + 1].index! : code.length;
    blocks.push({ filename, code: code.slice(start, end) });
  }

  // If there's content before the first separator
  if (matches[0].index! > 0) {
    const prefix = code.slice(0, matches[0].index!).trim();
    if (prefix) blocks.unshift({ filename: null, code: prefix });
  }

  return blocks;
}

// ─── Actions: Open in IDE / Download ──────────────────────────────────────

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadStageJSON(stage: string, data: any) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  triggerDownload(blob, `solvent-waterfall-${stage}.json`);
}

/** Extract individual {path, content} files from executor code string */
function extractCodeFiles(executorData: any): { path: string; content: string }[] {
  const d = normalizeData(executorData);
  if (!d?.code) return [];
  const blocks = splitCodeByFiles(d.code);
  return blocks
    .filter((b) => b.code.trim())
    .map((b) => ({ path: b.filename || 'pipeline-output.txt', content: b.code.trim() }));
}

// ─── Fallback renderers ────────────────────────────────────────────────────

const RawOutput = ({ text }: { text: string }) => (
  <div>
    <Label>Raw Output</Label>
    <div className="bg-black/60 border border-white/5 rounded-xl overflow-hidden">
      <pre className="p-4 font-mono text-[14px] text-slate-400 overflow-x-auto scrollbar-thin leading-relaxed whitespace-pre-wrap">
        {text}
      </pre>
    </div>
  </div>
);

const GenericOutput = ({ data }: { data: any }) => {
  // Try to render known-ish fields first
  const entries = Object.entries(data).filter(([k, v]) =>
    v != null && k !== 'message' && k !== '_parseError' && k !== 'raw'
  );

  if (entries.length === 0) {
    return <p className="text-[13px] text-slate-600 font-mono">No displayable output</p>;
  }

  return (
    <div className="space-y-4">
      {entries.map(([key, val]) => (
        <div key={key}>
          <Label>{key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}</Label>
          {typeof val === 'string' ? (
            <FormattedText text={val} />
          ) : Array.isArray(val) ? (
            <BulletList items={val.map((v: any) => typeof v === 'string' ? v : JSON.stringify(v))} className="text-slate-400" />
          ) : typeof val === 'object' ? (
            <pre className="p-3 bg-black/40 rounded-xl font-mono text-[12px] text-slate-400 overflow-x-auto scrollbar-thin">
              {JSON.stringify(val, null, 2)}
            </pre>
          ) : (
            <p className="text-[14px] text-slate-300">{String(val)}</p>
          )}
        </div>
      ))}
    </div>
  );
};

// ─── Main ──────────────────────────────────────────────────────────────────

export const WaterfallDetailPanel = ({ selectedStage, steps }: WaterfallDetailPanelProps) => {
  const { openFiles, setOpenFiles, setActiveFile, setCurrentMode } = useAppStore();

  const handleOpenInIDE = useCallback(() => {
    if (!selectedStage) return;
    const executorData = steps.executor.data;
    const newFiles = extractCodeFiles(executorData);
    if (newFiles.length === 0) return;

    // Merge: update existing files, append new ones
    const existingPaths = new Set(openFiles.map((f) => f.path));
    const merged = [...openFiles];
    for (const f of newFiles) {
      if (existingPaths.has(f.path)) {
        const idx = merged.findIndex((x) => x.path === f.path);
        merged[idx] = f;
      } else {
        merged.push(f);
      }
    }

    setOpenFiles(merged);
    setActiveFile(newFiles[0].path);
    setCurrentMode('coding');
  }, [selectedStage, steps.executor.data, openFiles, setOpenFiles, setActiveFile, setCurrentMode]);

  const handleDownload = useCallback(() => {
    if (!selectedStage) return;
    const step = steps[selectedStage];
    if (!step.data) return;
    downloadStageJSON(selectedStage, step.data);
  }, [selectedStage, steps]);

  return (
    <div className="flex flex-col">
      <AnimatePresence mode="wait">
        {!selectedStage ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex items-center justify-center"
          >
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-800">
              Click a stage to view output
            </p>
          </motion.div>
        ) : (
          <motion.div
            key={selectedStage}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col min-h-0 h-full"
          >
            {(() => {
              const step = steps[selectedStage];
              const cfg = STAGE_CONFIGS[selectedStage];
              const Icon = cfg.icon;
              const isCompleted = step.status === 'completed' && step.data && !isProcessingMarker(step.data);
              const hasExecutorCode = steps.executor.status === 'completed' && extractCodeFiles(steps.executor.data).length > 0;

              return (
                <>
                  {/* Panel header */}
                  <div className="flex items-center gap-3 pb-4 border-b border-white/[0.04] shrink-0">
                    <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center', cfg.bgColor)}>
                      <Icon size={15} className={cfg.textColor} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[13px] font-black uppercase tracking-[0.3em] text-white block">
                        {cfg.displayName}
                      </span>
                      <span className="text-[12px] text-slate-600 font-mono">{cfg.description}</span>
                    </div>

                    {/* Action buttons */}
                    {isCompleted && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        {hasExecutorCode && (
                          <button
                            onClick={handleOpenInIDE}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-jb-accent/10 border border-jb-accent/20 text-jb-accent text-[9px] font-black uppercase tracking-wider hover:bg-jb-accent/20 transition-all"
                          >
                            <Code size={11} />
                            Open in IDE
                          </button>
                        )}
                        <button
                          onClick={handleDownload}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-slate-400 text-[9px] font-black uppercase tracking-wider hover:bg-white/[0.08] transition-all"
                        >
                          <Download size={11} />
                          Download
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Panel body */}
                  <div className="flex-1 overflow-y-auto scrollbar-thin pt-5 pb-4">
                    {step.status === 'idle' && (
                      <p className="text-[13px] text-slate-700 font-mono">Waiting for pipeline to reach this stage...</p>
                    )}
                    {step.status === 'processing' && (
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          {[0, 1, 2].map((i) => (
                            <motion.div
                              key={i}
                              animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                              transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.25 }}
                              className={cn('w-1.5 h-1.5 rounded-full', `bg-${cfg.color}`)}
                            />
                          ))}
                        </div>
                        <span className="text-[13px] text-slate-600 font-mono animate-pulse">
                          {step.data?.message || 'Processing...'}
                        </span>
                      </div>
                    )}
                    {step.status === 'error' && step.error && (
                      <div className="flex items-start gap-2 text-rose-400">
                        <AlertCircle size={13} className="mt-0.5 shrink-0" />
                        <span className="text-[14px] font-mono">{step.error}</span>
                      </div>
                    )}
                    {step.status === 'completed' && step.data && !isProcessingMarker(step.data) && (
                      <>
                        {selectedStage === 'architect' && (
                          <ArchitectOutput data={step.data} textColor={cfg.textColor} />
                        )}
                        {selectedStage === 'reasoner' && (
                          <ReasonerOutput data={step.data} textColor={cfg.textColor} />
                        )}
                        {selectedStage === 'executor' && <ExecutorOutput data={step.data} />}
                        {selectedStage === 'reviewer' && <ReviewerOutput data={step.data} />}
                      </>
                    )}
                    {/* Auto-completed by state machine but real data hasn't arrived yet */}
                    {step.status === 'completed' && step.data && isProcessingMarker(step.data) && (
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          {[0, 1, 2].map((i) => (
                            <motion.div
                              key={i}
                              animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                              transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.25 }}
                              className={cn('w-1.5 h-1.5 rounded-full', `bg-${cfg.color}`)}
                            />
                          ))}
                        </div>
                        <span className="text-[13px] text-slate-600 font-mono animate-pulse">
                          Compiling results...
                        </span>
                      </div>
                    )}
                    {/* Fallback: completed but no data at all */}
                    {step.status === 'completed' && !step.data && (
                      <p className="text-[13px] text-slate-700 font-mono">Stage completed with no output data</p>
                    )}
                  </div>
                </>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
