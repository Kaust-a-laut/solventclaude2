import { appendFile, stat, rename, unlink, access } from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger';
import { ContextProvenance } from './contextService';

export interface HarnessSnapshot {
  RETRIEVAL_COUNT_DEFAULT: number;
  RETRIEVAL_COUNT_MASSIVE: number;
  RETRIEVAL_COUNT_CONSTRAINED: number;
  MIN_SCORE_STANDARD: number;
  MIN_SCORE_MASSIVE: number;
  SCORE_BOOST_UNIVERSAL: number;
  SCORE_BOOST_META_SUMMARY: number;
  SCORE_BOOST_CRYSTALLIZED: number;
  SCORE_BOOST_PERMANENT_RULE: number;
  SCORE_BOOST_KEYWORD_MATCH: number;
  SCORE_BOOST_TAG_MATCH: number;
  SCORE_BOOST_PER_RETRIEVAL: number;
  SCORE_BOOST_PER_IMPORTANCE: number;
  DEDUP_SIMILARITY_THRESHOLD: number;
  LINKED_MEMORY_SCORE_MULTIPLIER: number;
  SCORE_PENALTY_STALE_CODE: number;
}

export interface RetrievalTrace {
  id: string;
  ts: string;
  responseId: string;
  sessionId: string;
  mode: string;
  provider: string;
  model: string;
  query: string;
  harnessSnapshot: HarnessSnapshot;
  active: ContextProvenance['active'];
  suppressed: ContextProvenance['suppressed'];
  promptTokens: NonNullable<ContextProvenance['promptTokens']>;
  counts: ContextProvenance['counts'];
  pipelineMs: number;
  // Phase A: always null. Phase B will populate with user feedback signals.
  outcome: null | 'correction' | 'crystallized' | 'rerequested' | 'accepted';
}

const TRACE_FILE = path.join(process.cwd(), '.solvent_retrieval_traces.jsonl');
const ROTATE_1 = path.join(process.cwd(), '.solvent_retrieval_traces.1.jsonl');
const ROTATE_2 = path.join(process.cwd(), '.solvent_retrieval_traces.2.jsonl');
const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

async function rotateIfNeeded(): Promise<void> {
  try {
    await access(TRACE_FILE);
    const { size } = await stat(TRACE_FILE);
    if (size <= MAX_SIZE_BYTES) return;
    // Rotate: .2 is deleted, .1 becomes .2, current becomes .1
    try { await unlink(ROTATE_2); } catch { /* .2 may not exist */ }
    try { await rename(ROTATE_1, ROTATE_2); } catch { /* .1 may not exist */ }
    await rename(TRACE_FILE, ROTATE_1);
  } catch {
    // File doesn't exist yet — no rotation needed
  }
}

class TraceLogger {
  async appendTrace(trace: RetrievalTrace): Promise<void> {
    try {
      await rotateIfNeeded();
      await appendFile(TRACE_FILE, JSON.stringify(trace) + '\n', 'utf-8');
    } catch (err) {
      // Fire-and-forget: never let trace logging crash the main request
      logger.warn(`[TraceLogger] Failed to write trace: ${err}`);
    }
  }
}

export const traceLogger = new TraceLogger();
