# RAG Pipeline Audit — JourneyKits Knowledge Base Patterns

> **Priority: HIGH** — Audit Solvent's current embedding/retrieval pipeline against proven patterns from the JourneyKits Knowledge Base RAG kit. Identify highest-impact improvements before implementing.

**Goal:** Compare Solvent's existing chunking, retrieval, and ranking against the JourneyKits KB RAG system to identify concrete wins.

**Context:** The JourneyKits `matt-clawd/knowledge-base-rag` kit implements a production-hardened RAG system with 4 patterns worth evaluating against Solvent's pipeline:

1. **Sentence-boundary-aware chunking with overlap** — 800 char chunks, 200 char overlap, respects sentence endings. Prevents mid-sentence splits that degrade retrieval quality.

2. **Freshness + credibility reranking** — `score = similarity * (1 + freshness * 0.12) * (1 + credibility * 0.08)`. Linear 90-day freshness decay. Source credibility map by domain.

3. **Multi-source content extraction with fallback chains** — Raw fetch → Firecrawl → Chrome CDP. Graceful degradation for paywalled/JS-heavy sites.

4. **Candidate oversampling + dedup** — Fetch 5x candidates from vector store, rerank with metadata signals, deduplicate by source, return top-k.

---

## Audit Steps

### Step 1: Read current Solvent retrieval pipeline
- `backend/src/utils/hnswIndex.ts` — vector index implementation
- `backend/src/services/baseOpenAIService.ts` — embedding generation
- Any chunking/splitting logic in the codebase
- How context enrichment currently works in the waterfall pipeline

### Step 2: Compare chunking strategy
- How does Solvent currently split text for embedding?
- Is there sentence-boundary awareness?
- Is there overlap between chunks?
- What's the chunk size? Is it configurable?

### Step 3: Compare retrieval and ranking
- Does Solvent do pure vector similarity or any reranking?
- Is there freshness weighting?
- Is there any source quality/credibility signal?
- How many candidates are fetched vs returned?

### Step 4: Identify gaps and prioritize
- Rank each of the 4 improvements by impact vs effort
- Note which ones are independent (can ship separately)
- Draft implementation order

### Step 5: Write implementation spec
- For each improvement worth doing, write a concrete spec with file paths, code changes, and expected behavior

---

## Reference
- Kit source analyzed in conversation on 2026-04-04
- Full kit available via: `journey show --kit matt-clawd/knowledge-base-rag`
- Key files: `src/chunker.js`, `src/search.js`, `src/db.js`, `src/extractor.js`
- Kit uses Supabase + pgvector (not directly portable), but algorithms are infrastructure-agnostic
