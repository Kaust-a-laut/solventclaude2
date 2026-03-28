# Waterfall Pipeline Test Results

> 60 scored runs across 2026-03-18/19. All runs use the same 4-stage pipeline: Architect -> Reasoner -> Executor -> Reviewer.
> Two test prompts used: "Easy" (JWT middleware) and "Hard" (distributed rate limiter library with 8 complex requirements).

---

## All Runs — Ranked by Score

| #  | Run Name              | Architect            | Reasoner                  | Executor                  | Reviewer         | Score | Issues | Prompt |
|----|-----------------------|----------------------|---------------------------|---------------------------|------------------|-------|--------|--------|
| 1  | r2_baseline           | Gemini 2.5 Pro       | Gemini 2.5 Flash          | Qwen3 Coder (OR)          | Gemini 3.1 Pro   | 100   | 0      | Easy   |
| 2  | r2_maverick_gemma     | Maverick (OR)        | Qwen3 32B (Groq)          | Qwen3 Coder+ (DS)         | Gemma 3 27B      | 100   | 0      | Easy   |
| 3  | kimi25_kimi           | GPT-OSS (Groq)       | Kimi K2.5 (Ollama)        | Kimi K2 (Groq)            | Healer Alpha     | 99    | 1      | Easy   |
| 4  | final_c3              | GPT-OSS (Groq)       | Qwen3 32B (Groq)          | Qwen3 Coder+ (DS)         | Gemini 3.1 Pro   | 98    | 1      | Easy   |
| 5  | final_c1              | GPT-OSS (Groq)       | Qwen3 32B (Groq)          | Kimi K2 (Groq)            | GLM 4.5 Air      | 97    | 2      | Easy   |
| 6  | best_quality          | GPT-OSS (Groq)       | Qwen3 32B (Groq)          | Qwen3 Coder+ (DS)         | Healer Alpha     | 95    | 3      | Easy   |
| 7  | best_quality_v2       | GPT-OSS (Groq)       | Qwen3 32B (Groq) [FB]     | Kimi K2 (Groq)            | Healer Alpha     | 95    | 1      | Hard   |
| 8  | r3_exec_kimi_k2       | GPT-OSS (Groq)       | Qwen3 32B (Groq)          | Kimi K2 (Groq)            | Healer Alpha     | 95    | 2      | Easy   |
| 9  | final_c5              | GPT-OSS (Groq)       | Kimi K2.5 (Ollama)        | Kimi K2 (Groq)            | Healer Alpha     | 92    | 4      | Easy   |
| 10 | kimi25_kimi_v2        | GPT-OSS (Groq)       | Kimi K2.5 (Ollama)        | Kimi K2 (Groq)            | Healer Alpha     | 92    | 2      | Hard   |
| 11 | kimi_duo_v4           | GPT-OSS (Groq)       | Kimi K2.5 (Ollama)        | Kimi K2 (Groq)            | Healer Alpha     | 92    | 3      | Hard   |
| 12 | r3_reas_phi4          | GPT-OSS (Groq)       | Phi-4 R+ (OR)             | Qwen3 Coder+ (DS)         | Healer Alpha     | 92    | 2      | Easy   |
| 13 | best_quality_v3       | GPT-OSS (Groq)       | Qwen3 32B (Groq) [FB]     | Kimi K2 (Groq)            | Healer Alpha     | 91    | 3      | Hard   |
| 14 | hunter_kimi           | GPT-OSS (Groq)       | Hunter Alpha (OR)         | Kimi K2 (Groq)            | Healer Alpha     | 91    | 3      | Easy   |
| 15 | r3_exec_llama33_70b   | GPT-OSS (Groq)       | Qwen3 32B (Groq)          | Llama 3.3 70B (Groq)      | Healer Alpha     | 91    | 3      | Easy   |
| 16 | r3_exec_hunter        | GPT-OSS (Groq)       | Qwen3 32B (Groq)          | Hunter Alpha (OR)         | Healer Alpha     | 88    | 4      | Easy   |
| 17 | r3_reas_deepseek_r1   | GPT-OSS (Groq)       | DeepSeek R1 (OR)          | Qwen3 Coder+ (DS)         | Healer Alpha     | 88    | 4      | Easy   |
| 18 | glm_kimi              | GLM-4.7 (Ollama)     | Kimi K2.5 (Ollama)        | Kimi K2 (Groq)            | MiMo V2 (OR)    | 87    | 5      | Hard   |
| 19 | hard_kimi_duo         | GPT-OSS (Groq)       | Kimi K2.5 (Ollama)        | Kimi K2 (Groq)            | Healer Alpha     | 87    | 6      | Hard   |
| 20 | r3_exec_deepseek_v3   | GPT-OSS (Groq)       | Qwen3 32B (Groq)          | DeepSeek V3 (OR)          | Healer Alpha     | 87    | 4      | Easy   |
| 21 | r3_reas_hunter        | GPT-OSS (Groq)       | Hunter Alpha (OR)         | Qwen3 Coder+ (DS)         | Healer Alpha     | 87    | 2      | Easy   |
| 22 | best_quality_v4       | GPT-OSS (Groq)       | Qwen3 32B (Groq) [FB]     | Kimi K2 (Groq)            | Healer Alpha     | 85    | 5      | Hard   |
| 23 | deepseek_kimi_v4      | GPT-OSS (Groq)       | DeepSeek V3.2 (Ollama)    | Kimi K2 (Groq)            | Healer Alpha     | 85    | 7      | Hard   |
| 24 | glm_nemotron          | GLM-4.7 (Ollama)     | Nemotron 3 Super (Ollama) | Kimi K2 (Groq)            | MiMo V2 (OR)    | 85    | 8      | Hard   |
| 25 | groq_speed_v3         | GPT-OSS (Groq)       | Qwen3 32B (Groq)          | Kimi K2 (Groq)            | Healer Alpha     | 85    | 6      | Hard   |
| 26 | kimi_duo_enhanced     | GPT-OSS (Groq)       | Kimi K2.5 (Ollama)        | Kimi K2 (Groq)            | Healer Alpha     | 85    | 6      | Hard   |
| 27 | r2_deepseek_healer    | GPT-OSS (Groq)       | DeepSeek R1 (OR)          | Qwen3 Coder (OR)          | Healer Alpha     | 85    | 4      | Easy   |
| 28 | r2_gptoss_healer      | GPT-OSS (Groq)       | Qwen3 32B (Groq)          | Qwen3 Coder+ (DS)         | Healer Alpha     | 85    | 4      | Easy   |
| 29 | r2_hunter_healer      | GPT-OSS (Groq)       | Hunter Alpha (OR)         | Qwen3 Coder+ (DS)         | Healer Alpha     | 85    | 4      | Easy   |
| 30 | r3_reas_llama4_scout  | GPT-OSS (Groq)       | Llama 4 Scout (OR)        | Qwen3 Coder+ (DS)         | Healer Alpha     | 85    | 3      | Easy   |
| 31 | gptoss_nemotron       | GPT-OSS (Groq)       | Nemotron 3 Super (Ollama) | Kimi K2 (Groq)            | MiMo V2 (OR)    | 83    | 9      | Hard   |
| 32 | deepseek_ultra        | DS V3.1 (Ollama)     | DS V3.1 (Ollama)          | Qwen3 Coder 480B (Ollama) | MiMo V2 (OR)    | 78    | 8      | Hard   |
| 33 | kimi_duo_mimo         | GPT-OSS (Groq)       | Kimi K2.5 (Ollama)        | Kimi K2 (Groq)            | MiMo V2 (OR)    | 78    | 8      | Hard   |
| 34 | minimax_reasoner      | GPT-OSS (Groq)       | MiniMax M2.1 (Ollama)     | Kimi K2 (Groq)            | MiMo V2 (OR)    | 78    | 9      | Hard   |
| 35 | ollama_ultima         | Qwen 3.5 (Ollama)    | K2 Thinking (Ollama)      | Qwen3 Coder 480B (Ollama) | MiMo V2 (OR)    | 78    | 8      | Hard   |
| 36 | cogito_v2             | GPT-OSS (Groq)       | Cogito 2.1 (Ollama)       | Qwen3 Coder 480B (Ollama) | Healer Alpha     | 65    | 8      | Hard   |
| 37 | deepseek_kimi         | GPT-OSS (Groq)       | DeepSeek V3.2 (Ollama)    | Kimi K2 (Groq)            | Healer Alpha     | 65    | 7      | Hard   |
| 38 | hard_cogito           | GPT-OSS (Groq)       | Cogito 2.1 (Ollama)       | Qwen3 Coder 480B (Ollama) | Healer Alpha     | 65    | 8      | Hard   |
| 39 | groq_speed_enhanced   | GPT-OSS (Groq)       | Qwen3 32B (Groq)          | Kimi K2 (Groq)            | Healer Alpha     | 55    | 10     | Hard   |
| 40 | hard_powerhouse       | GPT-OSS (Groq)       | K2 Thinking (Ollama)      | Qwen 3.5 (Ollama)         | GLM-5 (Ollama)   | 55    | 7      | Hard   |
| 41 | powerhouse_v2         | GPT-OSS (Groq)       | K2 Thinking (Ollama)      | Qwen 3.5 (Ollama)         | GLM-5 (Ollama)   | 42    | 10     | Hard   |
| 42 | kimi_duo_v3           | GPT-OSS (Groq)       | Kimi K2.5 (Ollama)        | Kimi K2 (Groq)            | Healer Alpha     | 25    | 10     | Hard   |
| 43 | deepseek_kimi_v3      | GPT-OSS (Groq)       | DeepSeek V3.2 (Ollama)    | Kimi K2 (Groq)            | Healer Alpha     | 15    | 5      | Hard   |
| 44 | kimi_duo_v2           | GPT-OSS (Groq)       | Kimi K2.5 (Ollama)        | Kimi K2 (Groq)            | Healer Alpha     | 15    | 4      | Hard   |
| 45 | **claude_baseline**   | **Claude Opus 4.6**  | **Claude Opus 4.6**       | **Claude Opus 4.6**       | **Claude (self)** | **79** | **9** | Hard   |
| 46 | **glm_kimi_ep**       | **GLM-4.7 (Ollama)** | **Kimi K2.5 (Ollama)**    | **Kimi K2 (Groq)**        | **MiMo V2 (OR)** | **93** | **6** | Hard   |
| 47 | **groq_speed_ep**     | **GPT-OSS (Groq)**   | **Qwen3 32B (Groq)**      | **Kimi K2 (Groq)**        | **MiMo V2 (OR)** | **91** | **6** | Hard   |
| 48 | **kimi_duo_ep**       | **GPT-OSS (Groq)**   | **Kimi K2.5 (Ollama)**    | **Kimi K2 (Groq)**        | **MiMo V2 (OR)** | **89** | **5** | Hard   |
| 49 | **glm_speed_ep**      | **GLM-4.7 (Ollama)** | **Qwen3 32B (Groq)**      | **Kimi K2 (Groq)**        | **MiMo V2 (OR)** | **94** | **5** | Hard   |
| 50 | **deepseek_kimi_ep**  | **GPT-OSS (Groq)**   | **DeepSeek V3.2 (Ollama)**| **Kimi K2 (Groq)**        | **MiMo V2 (OR)** | **88** | **6** | Hard   |
| 51 | **best_quality_hard** | **GPT-OSS (Groq)**   | **Qwen3 32B (Groq)**      | **Kimi K2 (Groq)**        | **MiMo V2 (OR)** | **88** | **5** | Hard   |
| 52 | **glm_nemotron_ep**   | **GLM-4.7 (Ollama)** | **Nemotron 3 Super (Ollama)**| **Kimi K2 (Groq)**     | **MiMo V2 (OR)** | **85** | **5** | Hard   |
| 53 | **kimi25_kimi_hard**  | **GPT-OSS (Groq)**   | **Kimi K2.5 (Ollama)**    | **Kimi K2 (Groq)**        | **Healer Alpha** | **85** | **5** | Hard   |
| 54 | **best_quality_hard2**| **GPT-OSS (Groq)**   | **Qwen3 32B (Groq)**      | **Qwen3 Coder+ (DS)**     | **Healer Alpha** | **92** | **8** | Hard   |
| 55 | **exec_kimi_hard**    | **GPT-OSS (Groq)**   | **Qwen3 32B (Groq)**      | **Kimi K2 (Groq)**        | **Healer Alpha** | **86** | **7** | Hard   |
| 56 | **kimi25_kimi_mimo**  | **GPT-OSS (Groq)**   | **Kimi K2.5 (Ollama)**    | **Kimi K2 (Groq)**        | **MiMo V2 (OR)** | **87** | **6** | Hard   |
| 57 | **best_quality_mimo** | **GPT-OSS (Groq)**   | **Qwen3 32B (Groq)**      | **Qwen3 Coder+ (DS)**     | **MiMo V2 (OR)** | **88** | **9** | Hard   |
| 58 | **exec_kimi_mimo**    | **GPT-OSS (Groq)**   | **Qwen3 32B (Groq)**      | **Kimi K2 (Groq)**        | **MiMo V2 (OR)** | **88** | **6** | Hard   |
| 59 | **cerebras_groq**     | **GPT-OSS (Groq)**   | **Qwen3 32B (Groq)**      | **Kimi K2 (Groq)**        | **Qwen3 235B (Cerebras)** | **85** | **6** | Hard   |
| 60 | **cerebras_glm**      | **GLM-4.7 (Ollama)** | **Qwen3 32B (Groq)**      | **Kimi K2 (Groq)**        | **Qwen3 235B (Cerebras)** | **85** | **5** | Hard   |

> **[FB]** = Phi-4 R+ was offline; fell back to Qwen3 32B (Groq)
> **Runs 42-44** scored low due to chain failures (reasoner returned no structured decisions), not executor quality.
> **Runs 36-41** had either pre-jsonMode issues or used Ollama cloud executors that truncated output.
> **Run 45** is a baseline experiment where Claude Opus 4.6 played all 4 pipeline roles using the exact same stage prompts. Self-review score of 79 reflects Claude's honest self-assessment — found a real multi-window atomicity bug, 2 missed carried decisions, and dead code. Output volume was 10-50x larger than any model tested (16K architect, 24K reasoner, 46K executor).
> **Runs 46-48 (ep = enhanced prompts)**: Same models as earlier runs but with enhanced stage prompts (numbered sections, minimum item counts, self-contained step descriptions, longer examples) and architect maxTokens bumped from 2048 to 4096. All 3 presets improved significantly on hard prompt scores.
> **Run 49 (glm_speed_ep)**: NEW MIX — GLM-4.7 architect + Groq Speed reasoner. Highest honest hard-prompt score (94). Full compliance (40/40).
> **Runs 50-52**: Re-tests of architecture-limited presets with enhanced prompts. DeepSeek V3.2 reasoner improved 85→88. GLM-Nemotron held at 85 (Nemotron reasoner plateauing).
> **Runs 53-55**: Hard-prompt test of 95-100 easy-prompt scorers with their original reviewers. best_quality held best (95→92), kimi25_kimi dropped most (99→85). Confirms hard prompt is genuinely harder, not just reviewer inflation.
> **Runs 56-58**: Same configs as 53-55 but swapping reviewer to MiMo V2. MiMo scores 87-88 (tight band), Healer scored 85-92 (wider spread). MiMo and Healer converge within ~4 points on identical pipelines.
> **Runs 59-60 (Cerebras)**: First Cerebras provider tests — Qwen3 235B as reviewer. Scores 85 on both groq-speed and glm-speed pipelines. Slightly stricter than MiMo (compliance 30/40 vs MiMo's 36-40). Finds different issues: operator precedence bugs, eager Redis init, circuit breaker half-open state flaws. Ultra-fast inference (~1-2s reviewer phase). Viable OR-down fallback reviewer on independent provider.

---

## Model Performance by Role

### ARCHITECT

| Model                | Avg Score | Min | Max | Runs | Notes |
|----------------------|-----------|-----|-----|------|-------|
| Gemini 2.5 Pro       | 100.0     | 100 | 100 | 1    | Only tested once, rubber-stamp reviewer |
| Maverick (OR)        | 100.0     | 100 | 100 | 1    | Only tested once, rubber-stamp reviewer |
| **GLM-4.7 (Ollama)** | **86.0**  | 85  | 87  | 2    | Best reliable architect on hard prompts |
| GPT-OSS (Groq)       | 78.4      | 15  | 99  | 38   | Most tested; high variance includes chain failures |
| DS V3.1 (Ollama)     | 78.0      | 78  | 78  | 1    | Single run |
| Qwen 3.5 (Ollama)    | 78.0      | 78  | 78  | 1    | Single run |
| **Claude Opus 4.6**  | **79.0**  | 79  | 79  | 1    | Self-reviewed; most detailed output (16K chars) |

> GLM-4.7 is the standout new architect. GPT-OSS is reliable but its average is dragged down by downstream chain failures.
> Both Gemini 2.5 Pro and Maverick scored 100 but with rubber-stamp reviewers (Gemini 3.1 Pro, Gemma 3 27B) so those scores are inflated.

### REASONER

| Model                      | Avg Score | Min | Max | Runs | Notes |
|----------------------------|-----------|-----|-----|------|-------|
| Gemini 2.5 Flash           | 100.0     | 100 | 100 | 1    | Rubber-stamp reviewer |
| Phi-4 R+ (OR)              | 92.0      | 92  | 92  | 1    | Often offline on OpenRouter free tier |
| **Qwen3 32B (Groq)**       | **89.1**  | 55  | 100 | 14   | Most reliable reasoner, fastest |
| Hunter Alpha (OR)          | 87.7      | 85  | 91  | 3    | Solid but slower (OpenRouter) |
| DeepSeek R1 (OR)           | 86.5      | 85  | 88  | 2    | Often offline on OpenRouter free tier |
| Llama 4 Scout (OR)         | 85.0      | 85  | 85  | 1    | Single run |
| **Nemotron 3 Super (Ollama)** | **84.0** | 83 | 85  | 2   | New contender, fast (12B active) |
| DS V3.1 (Ollama)           | 78.0      | 78  | 78  | 1    | Single run |
| MiniMax M2.1 (Ollama)      | 78.0      | 78  | 78  | 1    | Single run |
| Kimi K2.5 (Ollama)         | 75.2      | 15  | 99  | 10   | Median ~87; avg dragged by chain failures |
| Cogito 2.1 (Ollama)        | 65.0      | 65  | 65  | 2    | Weak reasoner |
| K2 Thinking (Ollama)       | 58.3      | 42  | 78  | 3    | Unreliable, often produces broken plans |
| DeepSeek V3.2 (Ollama)     | 55.0      | 15  | 85  | 3    | Inconsistent, avg dragged by chain failures |
| **Claude Opus 4.6**        | **79.0**  | 79  | 79  | 1    | Self-reviewed; 12 steps, 15 carried decisions, 24K chars |

> Qwen3 32B on Groq is the reliability king — 14 runs with 89.1 average and blazing fast.
> Kimi K2.5 on Ollama cloud has higher peaks (99) but occasional chain failures tank the average.
> K2 Thinking is NOT recommended as a reasoner despite its size — unreliable structured JSON output.
> Nemotron 3 Super is a promising fast alternative to Kimi K2.5 with more consistent output.

### EXECUTOR

#### All Prompts

| Model                      | Avg Score | Min | Max | Runs | Notes |
|----------------------------|-----------|-----|-----|------|-------|
| Qwen3 Coder (OR)           | 92.5      | 85  | 100 | 2    | Free tier, sometimes offline |
| Llama 3.3 70B (Groq)       | 91.0      | 91  | 91  | 1    | Single easy-prompt run |
| **Qwen3 Coder+ (DS)**      | **90.6**  | 85  | 100 | 9    | Best on easy prompts, DashScope API |
| Hunter Alpha (OR)          | 88.0      | 88  | 88  | 1    | Single run |
| DeepSeek V3 (OR)           | 87.0      | 87  | 87  | 1    | Single run |
| **Kimi K2 (Groq)**          | **77.4**  | 15  | 99  | 24   | Best on hard prompts, most tested |
| Qwen3 Coder 480B (Ollama)  | 71.5      | 65  | 78  | 4    | Slow, incomplete on complex tasks |
| Qwen 3.5 (Ollama)          | 48.5      | 42  | 55  | 2    | Not viable as executor |
| **Claude Opus 4.6**        | **79.0**  | 79  | 79  | 1    | Self-reviewed; 46K chars, 11 files, no truncation |

#### Hard Prompt Only

| Model                      | Avg Score | Min | Max | Runs | Notes |
|----------------------------|-----------|-----|-----|------|-------|
| **Kimi K2 (Groq)**          | **72.8**  | 15  | 95  | 19   | Best hard-prompt executor by far |
| Qwen3 Coder 480B (Ollama)  | 71.5      | 65  | 78  | 4    | Close avg but 10x slower |
| Qwen 3.5 (Ollama)          | 48.5      | 42  | 55  | 2    | Truncates complex code |
| **Claude Opus 4.6**        | **79.0**  | 79  | 79  | 1    | Self-reviewed; complete code, found own bugs |

> Kimi K2 on Groq is the clear executor winner on hard prompts — fast (Groq inference) and produces the most complete code.
> Qwen3 Coder+ on DashScope is excellent for easier tasks (90.6 avg) but was not tested on the hard prompt.
> Ollama cloud executors are viable but significantly slower and produce less complete code.

### REVIEWER — Calibration

| Model              | Avg Score | Min | Max | Runs | Stdev | Notes |
|--------------------|-----------|-----|-----|------|-------|-------|
| Gemma 3 27B        | 100.0     | 100 | 100 | 1    | 0.0   | Rubber-stamps everything |
| Gemini 3.1 Pro     | 99.0      | 98  | 100 | 2    | 1.0   | Rubber-stamps, 50% failure rate |
| GLM 4.5 Air        | 97.0      | 97  | 97  | 1    | 0.0   | Rubber-stamps, good for demos |
| **MiMo V2 (OR)**   | **81.0**  | 78  | 87  | 7    | 3.6   | Most consistent honest reviewer |
| **Qwen3 235B (Cerebras)** | **85.0** | 85 | 85 | 2 | 0.0 | Honest, stricter on compliance, ultra-fast (~1s), independent provider |
| Healer Alpha (OR)  | 78.9      | 15  | 99  | 31   | 22.1  | Honest but highly variable |
| GLM-5 (Ollama)     | 48.5      | 42  | 55  | 2    | 6.5   | Fails on complex reviews (empty response) |
| **Claude (self)**  | **79.0**  | 79  | 79  | 1    | —     | Self-review; found atomicity bug, 2 missed decisions, dead code |

> **MiMo V2 Omni is the best reviewer** — tightest scoring band (stdev 3.6), consistently finds 5-9 real issues.
> **Qwen3 235B on Cerebras is the best fallback reviewer** — honest (85 avg), ultra-fast (~1s), on independent provider. Stricter on compliance than MiMo but finds different, implementation-level bugs.
> Healer Alpha is honest but its high variance (stdev 22.1) includes runs where chain failures produced bad code.
> Gemma 3 27B, Gemini 3.1 Pro, and GLM 4.5 Air are rubber-stamp reviewers — useful for demos, not quality assurance.
> GLM-5 chokes on long code reviews — returns empty responses for complex tasks.
> **Reviewer fallback chain**: MiMo V2 (OR) → Healer Alpha (OR) → Qwen3 235B (Cerebras) → GLM 4.5 Air (Ollama, last resort)

---

## Top Presets (Saved in WATERFALL_PRESETS)

| Preset         | Architect        | Reasoner              | Executor        | Reviewer    | Hard Score | Speed   |
|----------------|------------------|-----------------------|-----------------|-------------|------------|---------|
| **glm-speed**  | GLM-4.7 (Ollama) | Qwen3 32B (Groq)     | Kimi K2 (Groq)  | MiMo V2     | **94**     | ~1-2 min |
| **glm-kimi**   | GLM-4.7 (Ollama) | Kimi K2.5 (Ollama)    | Kimi K2 (Groq)  | MiMo V2     | **93**     | ~2-3 min |
| **groq-speed** | GPT-OSS (Groq)   | Qwen3 32B (Groq)     | Kimi K2 (Groq)  | MiMo V2     | **91**     | ~30 sec |
| kimi-duo       | GPT-OSS (Groq)   | Kimi K2.5 (Ollama)   | Kimi K2 (Groq)  | MiMo V2     | **89**     | ~2-3 min |
| deepseek-kimi  | GPT-OSS (Groq)   | DeepSeek V3.2 (Ollama)| Kimi K2 (Groq)  | MiMo V2     | **88**     | ~2-3 min |
| glm-nemotron   | GLM-4.7 (Ollama) | Nemotron 3S (Ollama)  | Kimi K2 (Groq)  | MiMo V2     | **85**     | ~2 min  |

> **glm-speed is the new recommended default** — highest hard-prompt score (94), full compliance, ~1-2 min. GLM-4.7 architect + Groq reasoner/executor is the best combination found.
> groq-speed is best when speed matters — 91 score in ~30 seconds, all Groq inference.
> GLM-4.7 as architect is the clear winner — appears in both top presets (94, 93).
> groq-speed is best when speed matters — all Groq inference, ~30 seconds total pipeline.
> kimi-duo has the highest ceiling (92) but also has occasional chain failures.

---

## Infrastructure Changes Made During Testing

1. **jsonMode support** — Added `format: 'json'` (Ollama), `response_format: {type: 'json_object'}` (Groq, OpenRouter, DashScope). Previously only Gemini handled jsonMode.
2. **Executor maxTokens: 2048 -> 16384** — Scores jumped 15-20 points across all combos. The #1 bottleneck.
3. **Reasoner maxTokens: 2048 -> 4096** — Prevents plan truncation on complex tasks.
4. **Reviewer maxTokens: 2048 -> 4096** — Allows detailed issue lists.
5. **Enhanced stage prompts** — Architect requires "X over Y because Z" decisions. Reasoner requires file paths in every step. Executor mandates complete code (no truncation). Reviewer has scoring calibration (90+ is rare).

---

## Test Conditions

- **Easy prompt**: "Build JWT auth middleware for Express with refresh tokens" (~150 tokens)
- **Hard prompt**: "Build a distributed rate limiter library with sliding window, token bucket, circuit breaker, distributed locking, TypeScript generics, weighted requests, and structured events" (~250 tokens, 8 complex requirements)
- **Server**: localhost:3001, dev mode
- **Ollama cloud**: Free tier, ~45-90 seconds per phase
- **Groq**: Free tier, ~2-5 seconds per phase
- **OpenRouter**: Free tier, intermittent model availability
- **DashScope**: API key, reliable
