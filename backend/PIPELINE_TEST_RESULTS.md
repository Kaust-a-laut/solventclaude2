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

---

## Round 2 — 3-Stage Pipeline Tests (2026-04-08)

> Pipeline architecture changed from 4-stage (Architect → Reasoner → Executor → Reviewer) to 3-stage (Planner → Executor → Reviewer). Several models from Round 1 are now retired (Healer Alpha, MiMo V2 Omni, Hunter Alpha — all gone from OpenRouter). New honest reviewers introduced: GLM 5.1, Nemotron 3 Super, Qwen 3.6 Plus.

### Rate Limiter Prompt Tests

| #  | Run                       | Planner               | Executor          | Reviewer          | Score | Time  | Notes |
|----|---------------------------|-----------------------|-------------------|-------------------|-------|-------|-------|
| 61 | glm-speed-fireworks       | GLM-4.7 (Fireworks)   | Kimi K2 (Groq)    | Llama 3.3 (Groq) → Qwen 3.5+ (DS) [FB] | 87 | 420s | Groq 413 on reviewer retry, fell back to DashScope |
| 62 | glm-nemotron-new          | GLM-4.7 (Ollama)      | Kimi K2 (Groq)    | Nemotron 3 Super (Ollama) | **89** | 116s | First-pass success, no retries |
| 63 | deepseek-kimi-qwen        | DeepSeek V3.2 (Ollama)| Kimi K2 (Groq)    | Qwen 3.6+ (DS)    | 82    | 147s  | DeepSeek produces 8-decision plans |
| 64 | deepseek-kimi-nemo        | DeepSeek V3.2 (Ollama)| Kimi K2 (Groq)    | Nemotron 3 Super  | 82    | 244s  | Same code, different breakdown vs Qwen |
| 65 | glm-nemotron-glm51        | GLM-4.7 (Ollama)      | Kimi K2 (Groq)    | GLM 5.1 (Ollama)  | 82    | 493s  | Retry death spiral, GLM 5.1 too harsh |
| 66 | deepseek32-glm51          | DeepSeek V3.2 (Ollama)| Kimi K2 (Groq)    | GLM 5.1 (Ollama)  | **85** | 496s  | Thoroughness premium — 9 decisions, 37/40 compliance |
| 67 | deepseek31-glm51          | DeepSeek V3.1 671B    | Kimi K2 (Groq)    | GLM 5.1 (Ollama)  | 83    | 275s  | V3.1 NOT meaningfully better than V3.2 |

### Round 2 Findings

**1. Reviewer harshness creates ~7-point gaps on identical code.**

Same planner + executor + code, different reviewers:

| Code source | Nemotron 3 Super | Qwen 3.6 Plus | GLM 5.1 |
|---|---|---|---|
| GLM-4.7 + Kimi K2 (rate limiter) | **89** | — | 82 |
| DeepSeek V3.2 + Kimi K2 (rate limiter) | 82 | 82 | **85** |

**Calibration order (lenient → strict):** Nemotron 3 Super → Qwen 3.6 Plus → GLM 5.1.

**2. The "thoroughness premium" — strict reviewers reward more decisions.**

DeepSeek V3.2 produces 8-9 key decisions per plan; GLM-4.7 produces 6. With Nemotron/Qwen 3.6, those extra decisions are *liabilities* (more chances for executor to miss something) → DeepSeek scores 82. With GLM 5.1, the math flips — each implemented decision earns compliance points, so DeepSeek gets 37/40 compliance vs GLM-4.7's 35/40 → final score 85 vs 82.

**Implication:** match planner thoroughness to reviewer style. Use thorough planners (DeepSeek) only with strict reviewers (GLM 5.1). Use leaner planners (GLM-4.7) with moderate reviewers (Nemotron, Qwen 3.6).

**3. GLM 5.1 retry death spiral confirmed.**

GLM 5.1 commonly scores honest code 75-82, below the 80 retry threshold. Retries waste 4-6 minutes and final code rarely improves significantly. GLM 5.1 runs averaged ~493s vs Nemotron's 116s on the same combo — **4× slowdown**.

**4. DeepSeek V3.1 671B is NOT meaningfully better than V3.2:cloud.**

Score: 83 vs 85 (within noise). Time: 275s vs 496s (V3.1 actually faster but only because V3.2 hit the GLM 5.1 retry spiral). Decisions: 8 vs 9. Recommendation: use V3.2:cloud, skip V3.1 671B.

**5. Nemotron 3 Super is a legitimate honest reviewer.**

Never tested in Round 1's reviewer column. Two runs in Round 2:
- GLM-4.7+Kimi+Nemotron = 89 (3 issues, all real & specific)
- DeepSeek V3.2+Kimi+Nemotron = 82 (5 issues)

Calibration agrees with Qwen 3.6 Plus on DeepSeek code (both gave 82). Slightly more lenient than GLM 5.1. **Best honest reviewer for production** — finds real issues without triggering retry storms.

### Reviewer Calibration Table (Round 2)

| Reviewer              | Avg Score | Style                | Speed | Best For |
|-----------------------|-----------|----------------------|-------|----------|
| **Nemotron 3 Super (Ollama)** | **86** | Honest, decision-aware, lenient on syntax | Fast (~30s) | Lean planners (GLM-4.7), production use |
| Qwen 3.6 Plus (DashScope) | 84 | Moderate, balanced     | Fast | Most planners |
| GLM 5.1 (Ollama Cloud)| 83 | Strict, thoroughness-rewarding | Slow (retries) | Thorough planners (DeepSeek V3.2) |

### Active 3-Stage Presets (Updated)

| Preset           | Planner          | Executor          | Reviewer            | Grade | Speed   |
|------------------|------------------|-------------------|---------------------|-------|---------|
| **glm-nemotron** | GLM-4.7 (Ollama) | Kimi K2 (Groq)    | Nemotron 3 Super    | **B+ (89)** | ~2 min  |
| **deepseek-coder** | DeepSeek V3.2  | Qwen3 Coder+ (DS) | GLM 5.1 (Ollama)    | **A- (90)** | ~5.5 min |
| **glm-speed**    | GLM-4.7 (Ollama) | Kimi K2 (Groq)    | GLM 5.1 (Ollama)    | B+ (87) | ~2-3 min |
| **silk-road**    | GLM-4.7 (Ollama) | Qwen 3.6+ (DS)    | GLM 5.1 (Ollama)    | B (82)  | ~5m+    |
| **deepseek-kimi**| DeepSeek V3.2    | Kimi K2 (Groq)    | GLM 5.1 (Ollama)    | B (85)  | ~5m+    |

---

## Round 3 — Exploration Tests (2026-04-08)

> Testing alternative planners (Nemotron, GLM 5.1, Gemini, MiniMax) and alternative executors (Qwen3 Coder+ on DashScope) to map out the full design space.

### Round 3 Runs

| #  | Run                       | Planner                 | Executor          | Reviewer          | Score | Time  | Decisions | Notes |
|----|---------------------------|-------------------------|-------------------|-------------------|-------|-------|-----------|-------|
| 68 | deepseek-coder            | DeepSeek V3.2 (Ollama)  | Qwen3 Coder+ (DS) | GLM 5.1 (Ollama)  | **90** | 331s | 10 | 🥇 Best hard-prompt score — saved as preset |
| 69 | nemotron-planner          | Nemotron 3 Super        | Kimi K2 (Groq)    | Nemotron (self)   | 85 | 68s | 8 | Fastest test ever, valid but not top |
| 70 | glm51-planner-solo        | GLM 5.1 (Ollama)        | Kimi K2 (Groq)    | Nemotron 3 Super  | 85 | ~130s | 6 | GLM 5.1 can plan, plateaus around deepseek-kimi |
| 71 | glm47-coder-nemo          | GLM-4.7 (Ollama)        | Qwen3 Coder+ (DS) | Nemotron 3 Super  | 88 | 202s | 4 | Between glm-nemotron and deepseek-coder, no unique niche |
| 72 | **gemini-speed-mirror**   | **Gemini 2.5 Pro**      | Kimi K2 (Groq)    | Nemotron 3 Super  | **85** | 198s | 4 | Gemini family is lean planner style (4 dec) |
| 73 | **gemini-pro-strict**     | **Gemini 3 Pro Preview**| Qwen3 Coder+ (DS) | GLM 5.1 (Ollama)  | **83** | 302s | 4 | Gemini 3 Pro ≈ 2.5 Pro in plan shape, not meaningfully more thorough |
| 74 | **minimax-strict**        | **MiniMax M2.1** (Ollama) | Qwen3 Coder+ (DS) | GLM 5.1 (Ollama) | **81** | 423s | 0 (broken JSON) | MiniMax produced malformed JSON, unable to structure plan |

### Round 3 Findings

**1. Thorough plan + clean executor + strict reviewer = max quality (validated).**

`deepseek-coder` (DeepSeek V3.2 + Qwen3 Coder+ + GLM 5.1) hit **90** — highest hard-prompt score ever, beating `glm-nemotron`'s 89 and `glm-speed`'s 87. Pattern: pair the most thorough planner with the cleanest executor and the strictest reviewer. Tradeoff is speed (5.5 min vs 2 min for glm-nemotron).

**2. The "decision count" spectrum is now mapped.**

| Planner style | Decisions | Example | + Lenient reviewer | + Strict reviewer |
|---|---|---|---|---|
| **Thorough** | 8-10 | DeepSeek V3.2 | 82 (Nemotron/Qwen) | **85-90** (GLM 5.1) ⬆ |
| **Medium** | 6-8 | GLM-4.7, Nemotron | **89** (Nemotron) | 82-87 (GLM 5.1) ⬇ |
| **Lean** | 4 | Gemini 2.5/3 Pro, GLM-4.7+QwenCoder | **85** (Nemotron) | 83 (GLM 5.1) ⬇ |
| **Broken** | 0 | MiniMax M2.1 | — | 81 |

**Match planner thoroughness to reviewer style.** DeepSeek goes UP with GLM 5.1 (+3). GLM-4.7 goes DOWN (-7). Gemini goes DOWN (-2).

**3. Gemini family characterized as lean planners.**

Both Gemini 2.5 Pro and Gemini 3 Pro Preview produced exactly 4 decisions on the rate limiter prompt. The flagship (3 Pro Preview) is NOT meaningfully more thorough than 2.5 Pro in this pipeline — they summarize architecturally rather than enumerate. Direct A/B vs `glm-nemotron` (same executor+reviewer, only planner changed):

| Planner | Score | Decisions |
|---|---|---|
| GLM-4.7 | **89** | 6 |
| Gemini 2.5 Pro | 85 | 4 |

**Verdict: Gemini is NOT a keeper as planner** — GLM-4.7 outperforms it in the same slot. Also NOT a keeper as reviewer per Round 1 data (rubber-stamps, 50% failure rate).

**4. MiniMax M2.1 is not viable as planner.**

Produced 21K chars of raw text that failed to parse as JSON (choked at char 3556). The executor still wrote code (fell back to raw text or prompt), scoring 81 — but the plan stage was effectively broken. Two independent tests now confirm MiniMax is weak in structured reasoning roles (Round 1 reasoner = 78, Round 3 planner = 81 with broken JSON).

**5. Qwen3 Coder+ as executor: confirmed upgrade, but only pays off with thorough planners.**

- DeepSeek V3.2 + Qwen3 Coder+ → **90** (+5 over DeepSeek + Kimi K2's 85)
- GLM-4.7 + Qwen3 Coder+ → 88 (-1 vs GLM-4.7 + Kimi K2's 89)
- Gemini 3 Pro Preview + Qwen3 Coder+ → 83 (no baseline to compare)

Qwen3 Coder+ produces cleaner syntax (+2-3 points typically) but runs on DashScope (~2x slower than Kimi K2 on Groq). The syntax gain only wins when the planner produces enough decisions to take advantage of it.

### Updated Reviewer Calibration (Round 3)

| Reviewer              | Avg Score | Style                | Speed | Best For |
|-----------------------|-----------|----------------------|-------|----------|
| **Nemotron 3 Super (Ollama)** | **86** | Honest, decision-aware, lenient on syntax | Fast (~30s) | Lean/medium planners, production use |
| Qwen 3.6 Plus (DashScope) | 84 | Moderate, balanced | Fast | Most planners |
| **GLM 5.1 (Ollama Cloud)** | **85** | Strict, thoroughness-rewarding | Slow (retries) | Thorough planners (DeepSeek V3.2) |

### Active 3-Stage Presets (Round 3 Update)

| Preset           | Planner          | Executor          | Reviewer            | Grade | Speed   |
|------------------|------------------|-------------------|---------------------|-------|---------|
| **deepseek-coder** | DeepSeek V3.2  | Qwen3 Coder+ (DS) | GLM 5.1 (Ollama)    | **A- (90)** | ~5.5 min |
| **glm-nemotron** | GLM-4.7 (Ollama) | Kimi K2 (Groq)    | Nemotron 3 Super    | **B+ (89)** | ~2 min  |
| **glm-speed**    | GLM-4.7 (Ollama) | Kimi K2 (Groq)    | GLM 5.1 (Ollama)    | B+ (87) | ~2-3 min |
| **deepseek-kimi**| DeepSeek V3.2    | Kimi K2 (Groq)    | GLM 5.1 (Ollama)    | B (85)  | ~5m+    |
| **silk-road**    | GLM-4.7 (Ollama) | Qwen 3.6+ (DS)    | GLM 5.1 (Ollama)    | B (82)  | ~5m+    |

### Round 3 Rejected Combos (tested, not saved)

- **glm47-coder-nemo** (88) — sits between glm-nemotron and deepseek-coder with no unique niche
- **nemotron-planner** (85) — fast but not top-tier
- **glm51-planner-solo** (85) — GLM 5.1 can plan but doesn't beat dedicated planners
- **gemini-speed-mirror** (85) — loses to glm-nemotron in same slot
- **gemini-pro-strict** (83) — Gemini doesn't benefit from thoroughness premium
- **minimax-strict** (81) — broken JSON output, unreliable as planner

---

## Round 3.5 — Alt-Reviewer + Same-Family Tests (2026-04-08)

> Testing whether Nemotron can replace GLM 5.1 in the deepseek-coder pipeline, whether Llama 4 Maverick is viable as planner, and whether same-family DashScope pairing (Qwen 3.6 Plus → Qwen3 Coder+) produces plan-execution fit.

### Round 3.5 Runs

| #  | Run                       | Planner                 | Executor          | Reviewer          | Score | Time  | Decisions | Notes |
|----|---------------------------|-------------------------|-------------------|-------------------|-------|-------|-----------|-------|
| 75 | **qwen36-planner**        | **Qwen 3.6 Plus (DS)**  | Qwen3 Coder+ (DS) | Nemotron 3 Super  | **88** | **84s** ⚡ | 3 | 🚀 Fastest 88+ tier ever — all DashScope, saved as `qwen-trinity` |
| 76 | llama4-maverick-nemo      | Llama 4 Maverick (Groq) | Qwen3 Coder+ (DS) | Nemotron 3 Super  | 85 | 170s | 6 | Medium plan but plan-executor fit issue (compliance 30/40) |
| 77 | deepseek-coder-nemo       | DeepSeek V3.2 (Ollama)  | Qwen3 Coder+ (DS) | Nemotron 3 Super  | 88 | 332s | 6 | Nemotron harsher on compliance than GLM 5.1 (-8 vs deepseek-coder); no speed advantage |

### Round 3.5 Findings

**1. 🚀 Same-family DashScope pairing wins on speed: `qwen-trinity` at 88 in 84 seconds.**

Qwen 3.6 Plus plans and Qwen3 Coder+ executes within the same provider (DashScope). The plan is leaner than any other (3 decisions!) but Qwen3 Coder+ executes it faithfully because they share style. Nemotron finds only 3 issues — fewest of any Nemotron run. **This is now the fastest path to 88+ in the pipeline**, at roughly 2/3 the time of `glm-nemotron` (116s) and 1/4 the time of `deepseek-coder` (331s).

Same-family plan→execute pairing is a new axis worth exploring further (Kimi K2.5 → Kimi K2, GLM 5.1 → GLM 4.7, etc).

**2. Nemotron is NOT a drop-in replacement for GLM 5.1 on thorough plans.**

Original hypothesis: "Swap GLM 5.1 → Nemotron in deepseek-coder, same score, faster (no retry spiral)." Result: **88 vs 90 (-2 points), same time (332s vs 331s).** 

Why it failed:
- Both runs passed first-pass, so there was no retry spiral to skip
- Nemotron rated DeepSeek's compliance **lower** than GLM 5.1 did (30/40 vs 38/40) — Nemotron is stricter on "did the code implement every decision" when decisions are many, while GLM 5.1 rewards each decision implemented
- DeepSeek V3.2's thoroughness varies between runs — this run only produced 6 decisions vs the 10 in the original deepseek-coder. Nondeterministic planner behavior.

**Implication:** GLM 5.1 and Nemotron have different strictness profiles at different scales. Nemotron likes clean simple plans; GLM 5.1 likes detailed ones.

**3. Llama 4 Maverick: medium-depth plans but plan-executor drift.**

Produced 6 decisions (medium, similar to GLM-4.7) but compliance came in at 30/40 — the lowest compliance for any medium-plan test. Reviewer noted: "Key decision 4 is violated" and "Key decision 2 is partially violated." The plan was reasonable; Qwen3 Coder+ just drifted from it. Efficiency 20/20 and syntax 20/20 though — Llama-planned code runs clean, it just doesn't match the plan.

**Implication:** Llama 4's planning style produces decisions that are hard for Qwen3 Coder+ to implement faithfully. Might work better with a lean executor that matches its style (Kimi K2?).

### Updated Rate-Limiter Leaderboard (all Round 2/3/3.5 runs)

| Rank | Combo | Score | Time | Decisions | Preset |
|---|---|---|---|---|---|
| 🥇 | DeepSeek V3.2 + Qwen3 Coder+ + GLM 5.1 | **90** | 331s | 10 | `deepseek-coder` |
| 🥈 | GLM-4.7 + Kimi K2 + Nemotron | **89** | 116s | 6 | `glm-nemotron` |
| 🥉 | **Qwen 3.6 Plus + Qwen3 Coder+ + Nemotron** | **88** | **84s** | 3 | **`qwen-trinity`** (NEW) |
| 🥉 | DeepSeek V3.2 + Qwen3 Coder+ + Nemotron | 88 | 332s | 6 | — |
| 🥉 | GLM-4.7 + Qwen3 Coder+ + Nemotron | 88 | 202s | 4 | — |
| 6 | GLM-4.7 + Kimi K2 + GLM 5.1 | 87 | 420s | 6 | `glm-speed` |
| 7 | Llama 4 Maverick + Qwen3 Coder+ + Nemotron | 85 | 170s | 6 | — |
| 7 | Gemini 2.5 Pro + Kimi K2 + Nemotron | 85 | 198s | 4 | — |
| 7 | Nemotron + Kimi K2 + Nemotron | 85 | 68s | 8 | — |
| 7 | DeepSeek V3.2 + Kimi K2 + GLM 5.1 | 85 | 496s | 8 | `deepseek-kimi` |
| 7 | GLM 5.1 + Kimi K2 + Nemotron | 85 | ~130s | 6 | — |
| 12 | Gemini 3 Pro Preview + Qwen3 Coder+ + GLM 5.1 | 83 | 302s | 4 | — |
| 13 | MiniMax M2.1 + Qwen3 Coder+ + GLM 5.1 | 81 | 423s | 0 (broken) | — |

### Active Top-Tier Presets (Post Round 3.5)

| Preset           | Planner          | Executor          | Reviewer            | Grade | Speed   | Niche |
|------------------|------------------|-------------------|---------------------|-------|---------|-------|
| **deepseek-coder** | DeepSeek V3.2  | Qwen3 Coder+ (DS) | GLM 5.1 (Ollama)    | **A- (90)** | ~5.5 min | Max quality |
| **glm-nemotron** | GLM-4.7 (Ollama) | Kimi K2 (Groq)    | Nemotron 3 Super    | **B+ (89)** | ~2 min  | Balanced quality/speed |
| **qwen-trinity** | Qwen 3.6 Plus    | Qwen3 Coder+ (DS) | Nemotron 3 Super    | **B+ (88)** | **~90s** | Fastest 88+ tier |
| **glm-speed**    | GLM-4.7 (Ollama) | Kimi K2 (Groq)    | GLM 5.1 (Ollama)    | B+ (87) | ~2-3 min | GLM-only (no DashScope) |

---

## Round 3.6 — GLM 5.1 Harshness + Kimi K2.5 Return (2026-04-08)

> Testing the "strict plan + strict review" hypothesis: does GLM-4.7 + Qwen3 Coder+ + GLM 5.1 beat deepseek-coder? Also: Kimi K2.5 untested as planner in 3-stage pipeline; does it still have the high ceiling from Round 1?

### Round 3.6 Runs

| #  | Run                   | Planner              | Executor          | Reviewer          | Score | Time  | Decisions | Notes |
|----|-----------------------|----------------------|-------------------|-------------------|-------|-------|-----------|-------|
| 78 | **kimi25-trinity**    | **Kimi K2.5** (Ollama) | Qwen3 Coder+ (DS) | Nemotron 3 Super | **90** | 293s | partial (JSON tail truncated) | 🥇 TIED TOP — saved as `kimi-coder`, first 90 from non-GLM-5.1 reviewer |
| 79 | deepseek-speed        | DeepSeek V3.2 (Ollama) | Kimi K2 (Groq)   | Nemotron 3 Super | 82    | 351s | 6 | DeepSeek + Nemotron = consistent 82 floor — thoroughness unrewarded |
| 80 | **glm-twin**          | GLM-4.7 (Ollama)     | Qwen3 Coder+ (DS) | GLM 5.1 (Ollama) | **75** | 434s | 5 | ⚠️ LOWEST honest score — strict plan + strict review is a TRAP when plan is lean |

### Round 3.6 Findings

**1. Kimi K2.5 validates as a top-tier planner in 3-stage pipeline.**

Score 90 with Nemotron reviewer — **the first 90 ever achieved with a non-GLM-5.1 reviewer.** Kimi K2.5 produces plans detailed enough (~6-8 decisions before truncation) to earn high compliance from Nemotron, paired with Qwen3 Coder+'s clean syntax. Faster than deepseek-coder too (293s vs 331s). Saved as `kimi-coder` preset.

**Breakdown comparison at 90:**

| Preset | Reviewer | Compliance | Security | Efficiency | Syntax |
|---|---|---|---|---|---|
| deepseek-coder | GLM 5.1 | 38/40 | ~17 | ~18 | ~19 |
| **kimi-coder** | Nemotron | 35/40 | 18/20 | 18/20 | 20/20 |

Different profiles — deepseek-coder wins on compliance (detail), kimi-coder wins on execution cleanliness (syntax).

**2. ⚠️ "Strict plan + strict review" is NOT a universal formula — it's a TRAP for lean plans.**

`glm-twin` (GLM-4.7 + Qwen3 Coder+ + GLM 5.1) scored **75** — the lowest honest-reviewer score in all 20+ Round 2/3 runs. Why: GLM-4.7 produced only 5 decisions, and GLM 5.1 found a **critical Redis interface mismatch bug** plus hit efficiency and security hard (13+12).

**The real rule:** Match planner thoroughness to reviewer strictness.
- **Thorough (10+ dec)** → GLM 5.1 (rewards each decision)
- **Medium-thorough (6-8)** → Nemotron (lenient on details, strict on execution)
- **Lean (3-5)** → Nemotron (Nemotron only counts what's there; GLM 5.1 *punishes* lean plans when it goes deep)

This explains why `deepseek-coder` (DeepSeek/10 dec + GLM 5.1) = 90 but `glm-twin` (GLM-4.7/5 dec + GLM 5.1) = 75. The planner must give GLM 5.1 enough surface area to reward.

**3. DeepSeek V3.2 + Kimi K2 + Nemotron = consistent 82 floor.**

Fourth independent test of DeepSeek + lenient reviewer, all scoring 82. DeepSeek's thoroughness is wasted when the reviewer doesn't reward decisions — it becomes surface area for compliance misses. **DeepSeek is only viable with GLM 5.1.**

**4. GLM 5.1 finds bugs other reviewers miss.**

In glm-twin: caught a critical Redis client interface mismatch and a SCRIPT LOAD/EVALSHA efficiency issue. Nemotron, Qwen 3.6 Plus, and others never flagged these in similar runs. GLM 5.1 is genuinely the most rigorous reviewer — it just needs to be paired with thorough plans to avoid score collapse.

**5. JSON output truncation is a recurring issue — fallback handling works but loses decisions.**

Both `kimi25-trinity` (tail truncation) and `minimax-strict` (mid-truncation) produced malformed planner JSON. The pipeline has partial-plan fallback that kept the score at 90 for kimi25-trinity, but there's a real opportunity: if we fix JSON robustness (maybe via repair-pass or streaming parse), these runs could score even higher.

### Updated Pattern Summary (Rounds 2 + 3 + 3.5 + 3.6)

| Plan style | Decisions | Best reviewer | Worst reviewer | Evidence |
|---|---|---|---|---|
| **Thorough** | 8-10 | GLM 5.1 (+3-5) | Nemotron/Qwen 3.6 (baseline 82) | DeepSeek V3.2: 90 vs 82 |
| **Medium** | 6-8 | Nemotron (+3-7) | GLM 5.1 (baseline 82-87) | Kimi K2.5: 90, GLM-4.7: 89 |
| **Lean** | 3-5 | Nemotron (+5-10) | GLM 5.1 (-10 or worse) | qwen-trinity: 88, glm-twin: **75** |
| **Broken** | 0 | — | — | MiniMax: 81 |

### Ceiling analysis (prompt vs rubric)

- **Top 12 honest-reviewer runs on rate limiter:** scores range 82-90 (~8-point band)
- **Compliance ceiling:** 38/40 (observed max, by deepseek-coder) — no run has achieved 40/40
- **Syntax ceiling:** 20/20 (observed often) — hard ceiling, reachable
- **Security ceiling:** ~18/20 (effective max) — soft ceiling, always dings 1-2 points
- **Efficiency ceiling:** 20/20 (observed) — hard ceiling, reachable
- **Effective rubric max:** ~96 (38 + 18 + 20 + 20), realistic max ~90-93

The rate limiter + rubric combination caps at ~90. We have **7 runs tied or above 85** and **2 runs at exactly 90**, suggesting we're hitting a real ceiling. **Round 4 will test a novel prompt to disambiguate prompt-specific vs rubric ceiling.**

### Active Top-Tier Presets (Post Round 3.6)

| Preset           | Planner              | Executor          | Reviewer            | Grade | Speed   | Niche |
|------------------|----------------------|-------------------|---------------------|-------|---------|-------|
| **deepseek-coder** | DeepSeek V3.2      | Qwen3 Coder+ (DS) | GLM 5.1 (Ollama)    | **A- (90)** | ~5.5 min | Max thoroughness |
| **kimi-coder**    | **Kimi K2.5** (Ollama) | Qwen3 Coder+ (DS) | Nemotron 3 Super    | **A- (90)** | ~5 min   | **Tied top, no GLM 5.1 dependency** |
| **glm-nemotron**  | GLM-4.7 (Ollama)   | Kimi K2 (Groq)    | Nemotron 3 Super    | **B+ (89)** | ~2 min  | Balanced quality/speed |
| **qwen-trinity**  | Qwen 3.6 Plus      | Qwen3 Coder+ (DS) | Nemotron 3 Super    | **B+ (88)** | **~90s** | Fastest 88+ tier |
| **glm-speed**     | GLM-4.7 (Ollama)   | Kimi K2 (Groq)    | GLM 5.1 (Ollama)    | B+ (87) | ~2-3 min | GLM-only |

---

## Round 4 — Novel Prompt Stress Test (2026-04-08)

> Question: are we hitting a **rubric ceiling** or a **prompt ceiling**? Round 3 ran ~20 presets on the rate limiter and the top cluster bunched at 88-90. This round reruns the top 4 presets on a completely novel prompt (CSV → normalized JSON streaming transformer with multi-locale number/boolean/date parsing, backpressure, and configurable column mapping) to see which drops hold up and which were overfit.

### Round 4 Runs — CSV streaming transformer prompt

| #  | Run                    | Planner              | Executor          | Reviewer          | Score | Time  | Decisions   | Δ vs RL  |
|----|------------------------|----------------------|-------------------|-------------------|-------|-------|-------------|----------|
| 81 | **r4-kimi-coder**      | Kimi K2.5 (Ollama)   | Qwen3 Coder+ (DS) | Nemotron 3 Super  | **82** | 487s | **9** (grew from ~6-8) | **-8**  |
| 82 | r4-glm-nemotron        | GLM-4.7 (Ollama)     | Kimi K2 (Groq)    | Nemotron 3 Super  | 75    | 545s | 7 (was 6)   | -14     |
| 83 | r4-qwen-trinity        | Qwen 3.6 Plus (DS)   | Qwen3 Coder+ (DS) | Nemotron 3 Super  | 72    | 242s | 7 (was 3)   | -16     |
| 84 | r4-deepseek-coder-solo | DeepSeek V3.2 (Oll)  | Qwen3 Coder+ (DS) | GLM 5.1 (Ollama)  | **63** | 793s | 8 (**shrank** from 10) | **-27** |

**Score breakdowns:**

| Run              | Compliance | Security | Efficiency | Syntax | Issues |
|------------------|-----------:|---------:|-----------:|-------:|-------:|
| r4-kimi-coder    | 30/40      | 16/20    | 16/20      | 20/20  | 6      |
| r4-glm-nemotron  | 30/40      | 15/20    | 15/20      | 15/20  | 8      |
| r4-qwen-trinity  | 25/40      | 12/20    | 18/20      | 17/20  | 5      |
| r4-deepseek-coder| 26/40      | 12/20    | 8/20       | 17/20  | **12** |

**Note:** `r4-deepseek-coder`'s first parallel attempt terminated at ~1083s (suspected GLM 5.1 retry death spiral under rate-limit contention hitting the 20-min fetch timeout). Solo retry succeeded at 793s.

### Round 4 Findings

**1. The rate limiter prompt massively compressed score separation.**

Every preset dropped. The *magnitude* of the drop is the signal:

- kimi-coder -8 → robust
- glm-nemotron -14 → moderate
- qwen-trinity -16 → moderate
- **deepseek-coder -27 → brittle**

Confirms the rate limiter was a ceiling-compressor. Scoring gaps exist; the prompt was hiding them.

**2. Kimi K2.5 is the most novelty-robust planner we have tested.**

Decision counts moved in opposite directions on novel input:

| Planner       | Rate limiter | CSV | Δ |
|---|---|---|---|
| **Kimi K2.5** | ~6-8 | **9** | **+1 to +3 (grew)** |
| Qwen 3.6 Plus | 3 | 7 | +4 (reactive, had room) |
| GLM-4.7 | 6 | 7 | +1 |
| **DeepSeek V3.2** | **10** | **8** | **-2 (shrank)** |

A good planner should **add** rigor on novel work, not subtract. Kimi K2.5 did. DeepSeek V3.2 did the opposite — strong evidence its "thoroughness" on the rate limiter was template-driven pattern matching, not reasoning.

**3. `deepseek-coder` was overfit to the rate limiter.**

GLM 5.1 (the strict reviewer that made this preset look like gold on the rate limiter) found **12 real issues** in the CSV implementation:

- 3 critical bugs: `CsvStreamReader` reuse after stream exhaustion, `createReadStream` encoding mismatch (strings vs Buffers), `BackpressureController.rowCount` only ever increments
- Prototype pollution vuln in the field flattener (`__proto__.polluted` column name would mutate `Object.prototype`)
- Locale-naive number coercion destroying en-US decimals, synchronous file I/O blocking the event loop, boolean detection only covering English

This isn't rubric harshness — the code is genuinely broken. Qwen3 Coder+ had seen countless rate limiter examples in training, far fewer CSV streaming transformers. The "A- at 90" score was real for that domain, not general.

**4. `kimi-coder` is the real top preset.**

- Best novelty robustness (-8 drop)
- Tied top score on rate limiter (90)
- Only preset where the planner **grew** its decision count on novel work
- Best syntax score on both prompts (20/20)
- No GLM 5.1 retry spiral risk
- No timeout drama

`kimi-coder` should become the default recommendation. `deepseek-coder` needs a warning label or demotion to "specialty: verbose well-documented domains".

**5. "Fastest 88+ tier" (qwen-trinity) holds up on speed but not score on novel work.**

242s on novel work is still under 5 min, but a 72 with critical gaps is not acceptable for a default. `qwen-trinity` remains the right "quick sketch" preset but not a quality default.

### Provisional re-tiering (pending Round 5 confirmation)

| Rank | Preset | Rate limiter | CSV | Avg | Reliability |
|---|---|---|---|---|---|
| 🥇 1 | **kimi-coder** | 90 | 82 | 86 | stable |
| 🥈 2 | glm-nemotron | 89 | 75 | 82 | stable |
| 🥉 3 | qwen-trinity | 88 | 72 | 80 | stable, fastest |
| ⚠️ 4 | deepseek-coder | 90 | 63 | 76.5 | brittle, first attempt failed |

---

## Round 5 — Second Novel Prompt Confirmation + New Preset `kimi-strict` (2026-04-08)

> Goal: confirm the Round 4 pattern on a *third* prompt (distributed work queue with weighted fair scheduling, exponential backoff, poison-pill detection, DLQ, graceful shutdown) and introduce one new preset — **`kimi-strict`** (Kimi K2.5 + Qwen3 Coder+ + GLM 5.1) — to test whether the most novelty-robust planner can sidestep the `glm-twin` trap when paired with strict review.

### Round 5 Runs — distributed work queue prompt

| #  | Run                      | Planner              | Executor          | Reviewer          | Score  | Time  | Notes |
|----|--------------------------|----------------------|-------------------|-------------------|--------|-------|-------|
| 85 | **r5-qwen-trinity**      | Qwen 3.6 Plus (DS)   | Qwen3 Coder+ (DS) | Nemotron 3 Super  | **85** | 238s  | 🥇 HIGHEST novel score, breakdown 30/15/20/20 — efficiency 20 + syntax 20 |
| 86 | **r5-kimi-coder**        | Kimi K2.5 (Ollama)   | Qwen3 Coder+ (DS) | Nemotron 3 Super  | **82** | 286s  | 🥈 IDENTICAL to CSV (82), breakdown 30/18/16/18 — rock-solid consistency |
| 87 | r5-glm-nemotron          | GLM-4.7 (Ollama)     | Kimi K2 (Groq)    | Nemotron 3 Super  | 76     | 347s  | Stable floor, breakdown 25/18/16/17 |
| 88 | r5-kimi-strict *(NEW)*   | Kimi K2.5 (Ollama)   | Qwen3 Coder+ (DS) | GLM 5.1 (Ollama)  | **76¹** | fail | First-pass 76 (30/16/12/18), pipeline retry loop failed 2× |
| 89 | r5-deepseek-coder        | DeepSeek V3.2 (Oll)  | Qwen3 Coder+ (DS) | GLM 5.1 (Ollama)  | **76¹** | fail | First-pass 76 (**34**/14/11/17) — highest compliance on novel work ever. Failed twice, both attempts. |

¹ = reviewer returned a real score on first pass; the preset is marked "failed" because the pipeline retry-on-below-threshold loop triggered Ollama Cloud `fetch failed` on subsequent review passes. See "Pipeline bug discovered" below.

### Round 5 Findings

**1. 🥇 `qwen-trinity` just became interesting on novel work.**

Round 4 called `qwen-trinity` the weakest top-tier preset on novel prompts (72 on CSV). Round 5 flipped that — **85 on work queue**, the highest novel-prompt score of any preset. Breakdown: efficiency 20/20 AND syntax 20/20. The jump tells us `qwen-trinity`'s variance is *domain-dependent*, not general weakness. It struggled with streaming/backpressure (CSV) but crushed concurrency primitives (work queue). Its ~4 min time is now the best quality/speed tradeoff when the prompt isn't streaming-heavy.

**2. 🥈 `kimi-coder` hit 82 twice in a row.**

Across three prompts: 90 (rate limiter) → 82 (CSV) → 82 (work queue). Zero variance on novel prompts. Breakdowns differ slightly (CSV was 30/16/16/20, work queue was 30/18/16/18) but the total is locked at 82. This is the most consistent preset we have — and the only one that never produced critical bugs on any of the 3 prompts. The planner produced thoughtful decisions on both novel prompts with no regression.

**3. `glm-nemotron` is reliable mid-pack.**

76 on work queue tracks 75 on CSV. Breakdown shifted (25/18/16/17 vs 30/15/15/15) — GLM-4.7's 6-7 decision style with Nemotron is a floor, not a ceiling.

**4. 💥 `deepseek-coder` real score is 76, not 90.**

Three pipeline "failures" in two rounds — but the backend log reveals the truth. On every first-pass review GLM 5.1 scored the deepseek-coder output at 76 (breakdown 34/14/11/17). Compliance 34/40 is the **highest compliance score we've ever seen on novel work**, confirming DeepSeek V3.2's plans are detailed. But efficiency 11 and syntax 17 show Qwen3 Coder+'s execution has real bugs on novel domains. **The "A- (90)" grade was purely rate-limiter pattern matching.** On novel work, `deepseek-coder` scores the same as `kimi-strict` (76) and worse than `kimi-coder` (82) — while failing to complete the pipeline most of the time.

**5. `kimi-strict` (NEW preset) matches `deepseek-coder` exactly: 76.**

First-pass breakdown: 30/16/12/18. The hypothesis was "Kimi K2.5's adaptive thoroughness sidesteps the glm-twin trap → strict review adds value". Result: the underlying reviewer score is identical to `deepseek-coder` (76) but with a very different breakdown — Kimi K2.5 produced a slightly less detailed plan (compliance 30 vs 34) but the execution was cleaner (syntax 18 vs 17). GLM 5.1's strictness pulls both presets to the same floor regardless of planner detail. **Conclusion: strict review does not add value over Nemotron on novel work with this executor.** Kimi K2.5's +4 compliance ceiling with Nemotron (kimi-coder at 82) beats its GLM 5.1 ceiling (kimi-strict at 76).

**6. 🚨 Pipeline bug discovered: GLM 5.1 reviewer + threshold decay + Ollama Cloud = unrecoverable.**

Every GLM 5.1 reviewer run on novel prompts exhibits the same failure pattern:

1. First-pass review scores below threshold (76 < 80)
2. `waterfallService` decays threshold 80 → 72 → 65 and re-runs the executor with reviewer feedback
3. Second or third review call to Ollama Cloud returns `fetch failed` (transient network error, likely rate limit or service blip)
4. No retry budget left on the inner fetch → pipeline reports "terminated"

We hit this on **four separate runs** in Round 5 (r5-deepseek-coder parallel, r5-kimi-strict parallel, r5-kimi-strict solo, r5-deepseek-coder solo). 100% failure rate for GLM 5.1 reviewer presets on the work queue prompt, despite the reviewer successfully producing first-pass scores every time.

**Fix options** (file a ticket):
- Harden the inner fetch retry in `baseOpenAIService` to survive transient `fetch failed` errors with longer backoff
- Disable threshold-decay retry when reviewer is GLM 5.1 (accept first-pass score)
- Detect consecutive `fetch failed` and short-circuit to "use first-pass score"

### Round 4 + 5 Combined Scoreboard

| Preset | Rate Limiter | CSV | Work Queue | Avg (novel) | Stdev | Reliability |
|---|---|---|---|---|---|---|
| 🥇 **kimi-coder** | 90 | 82 | 82 | **82.0** | 0.0 | ✅ 100% complete |
| 🥈 **qwen-trinity** | 88 | 72 | 85 | 78.5 | 9.2 | ✅ 100% complete, **fastest** |
| 🥉 **glm-nemotron** | 89 | 75 | 76 | 75.5 | 0.7 | ✅ 100% complete |
| ⚠️ **kimi-strict** *(NEW)* | — | — | 76* | 76.0 | — | ❌ Pipeline retry bug |
| ⚠️ **deepseek-coder** | 90 | 63 | 76* | 69.5 | 9.2 | ❌ 3/3 novel failures, retry bug |

\* = first-pass reviewer score, pipeline marked failed

### Final Re-Tier Decision (Post Round 5)

**Promotions:**
- 🥇 **`kimi-coder` → DEFAULT** — most consistent (stdev 0 on novel), best bug-free code, A- grade stays
- 🥈 **`qwen-trinity` → "Fast & Flexible"** — highest single novel score (85), fastest (<4 min), domain-variance noted
- 🥉 **`glm-nemotron` → "Reliable Mid-Tier"** — consistent 75-76 floor, 2-6 min, no drama

**Demotions:**
- ⚠️ **`deepseek-coder` → "Legacy / Rate Limiter Specialty"** — real novel score is 76 tied with kimi-strict, but fails the pipeline 3/3 times on novel work. Add warning label or hide from UI until retry bug is fixed.

**New preset `kimi-strict`: NOT saved.** Provides no score advantage over `kimi-coder` (76 vs 82) and inherits the same `deepseek-coder` pipeline retry bug. Revisit after waterfallService is hardened against GLM 5.1 retry loops.

### Planner Novelty-Robustness Ranking (Rounds 4 + 5 data)

| Rank | Planner | Rate limiter | CSV | Work Queue | Δ avg vs RL | Verdict |
|---|---|---|---|---|---|---|
| 1 | **Kimi K2.5** | 90 | 82 | 82 | **-8.0** | Most robust, grows decision count on novel |
| 2 | **Qwen 3.6 Plus** | 88 | 72 | 85 | -9.5 | High variance, peaks high |
| 3 | **GLM-4.7** | 89 | 75 | 76 | -13.5 | Consistent mid |
| 4 | **DeepSeek V3.2** | 90 | 63 | 76¹ | **-20.5** | Brittle, shrinks decisions on novel, unreliable |

### Key Insight (Round 5's biggest takeaway)

**Rubric-ceiling ≠ capability ceiling.** The rate limiter prompt had a hard ceiling around 90 that made 7+ presets look equivalent. Two novel prompts later, the real ceiling is **82** (kimi-coder) and it's only achievable by *one* preset. The spread between #1 and #5 on novel work is **12 points** — hugely informative compared to the 2-point spread we saw on the rate limiter. Round 5 fully validates the novel-prompt methodology: one more data point could firm up the `qwen-trinity` variance question, but the kimi-coder / deepseek-coder winners/losers verdict is now locked.

---

## Round 6 — `deepseek-coder` Fair-Chance Test on Medium-High Prompt (2026-04-08)

> Before fully demoting `deepseek-coder`, give it one last shot on a prompt that's non-trivial but not adversarial. Rounds 4 and 5 used exotic composition domains (CSV streaming with multi-locale parsing, distributed work queue with DLQ + poison-pill). This round uses a **webhook signature verification + replay protection** middleware — concrete crypto primitives, LRU nonce cache, multi-secret rotation. Medium-high difficulty: the pattern is well-documented (Stripe/GitHub webhooks), but the specific API shape and state management are non-trivial.

### Round 6 Run — Webhook signature verification prompt

| #  | Run                  | Planner              | Executor          | Reviewer          | Score  | Time  | Notes |
|----|----------------------|----------------------|-------------------|-------------------|--------|-------|-------|
| 90 | **r6-deepseek-coder** | DeepSeek V3.2 (Oll) | Qwen3 Coder+ (DS) | GLM 5.1 (Ollama)  | **87** | 468s  | **PASSED threshold first pass**, compliance 38/40, breakdown 38/15/15/19 |

**Pipeline actually completed successfully.** Score 87 > threshold 80 on first review pass, no retry loop, no decay, no fetch-failed spiral. The only reason the client saw `terminated` at 301s is a **separate client-side bug**: `pipeline-test.mjs` uses `fetch` with `undici`'s default 5-minute idle timeout, which expires during the ~5-minute DeepSeek V3.2 planner phase when no SSE events are streaming. The backend ran to completion; result was recovered from backend log.

**Stage timings:**
- Planner (DeepSeek V3.2 on Ollama Cloud): 5m 1s (!)
- Executor (Qwen3 Coder+ on DashScope): 2m 47s
- Reviewer (GLM 5.1 on Ollama Cloud): ~11s (first pass)
- **Total: 7m 48s**

### Round 6 Findings

**1. 💥 deepseek-coder is NOT broken on novel work — it's broken on EXOTIC COMPOSITION.**

The Round 4/5 narrative was "deepseek-coder overfit to rate limiter". Round 6 refines that: **deepseek-coder is excellent on canonical patterns with strong training-data coverage** (rate limiters, webhook signatures, OAuth, auth middleware, CRUD) and **weak on novel composition** (distributed systems, streaming transformers, concurrency primitives). The distinction isn't novelty — it's whether the pattern exists richly in training data.

**Score by prompt category:**

| Prompt | Category | Score | Passed threshold? |
|---|---|---|---|
| Rate limiter | Canonical (common) | 90 | ✅ |
| Webhook signature + replay | Canonical (medium-high) | **87** | ✅ |
| CSV streaming transformer | Exotic composition | 76¹ | ❌ (retry spiral) |
| Distributed work queue | Exotic composition | 76¹ | ❌ (retry spiral) |

This is a clear split. Two canonical prompts hit 87-90, two exotic prompts hit 76. **87 on webhook signature is actually impressive** — the highest compliance score we've seen on non-rate-limiter work (38/40, tied with the all-time rate-limiter ceiling).

**2. The issues GLM 5.1 found on the webhook implementation are real but NOT critical.**

Unlike Round 4's CSV run (3 critical bugs + prototype pollution) or Round 5's work queue runs (multiple deadlock/starvation risks), Round 6's issues are "nice to fix" polish:

- Missing `maxBodyBytes` limit on `rawBodyParser` (DoS vector — real but easy fix)
- `computeHMAC` builds an intermediate string instead of streaming the Buffer (perf polish on large webhooks)
- `LRUCache` sweep `setInterval` never cleaned up — needs `destroy()` method

These are all correctness/hardening nits, not fundamental logic bugs. The core algorithms (HMAC-SHA256, timing-safe compare, LRU eviction, multi-secret rotation) were implemented correctly.

**3. The GLM 5.1 retry-spiral bug is domain-gated.**

Round 5: GLM 5.1 scored 4 exotic-prompt runs at 76, every one hit the retry death spiral → fetch failed. Round 6: GLM 5.1 scored the canonical prompt at 87 on first pass, no retry triggered, pipeline completed clean. This confirms the retry bug only fires when the first-pass score is below threshold 80. **As long as deepseek-coder stays in its canonical-pattern niche, the retry bug doesn't get triggered.**

**4. 🐛 New bug discovered: `pipeline-test.mjs` client timeout.**

The client's `fetch` call uses `undici`'s default 5-minute idle-socket timeout. Slow Ollama Cloud planners (DeepSeek V3.2, GLM 5.1, Nemotron) can take 5+ minutes to produce their first SSE event. The client kills the connection before the planner finishes; meanwhile the backend runs to completion with no one listening. **Fix: pass a custom `undici.Agent` with `bodyTimeout: 0` and `headersTimeout: 0`, or use `Dispatcher` with a longer idle timeout. File separately.**

### Revised Final Re-Tier (Post Round 6)

`deepseek-coder` is NOT demoted to "Legacy". It stays in the top tier with a **clear scope hint**:

| Rank | Preset | Grade | Speed | Best at | Avoid |
|---|---|---|---|---|---|
| 🥇 1 | **kimi-coder** | **A-** (82-90) | ~5 min | Default — highest consistency, zero variance, best novel-work bug rate | Nothing — safest bet |
| 🥈 2 | **qwen-trinity** | **B+** (72-88) | ~3-4 min | Fast iteration, concurrency primitives (85 on work queue) | Streaming transforms (72 on CSV) |
| 🥉 3 | **glm-nemotron** | **B+** (75-89) | ~2-6 min | Reliable mid-tier, balanced quality/speed | Nothing specific — always mid-pack |
| 🏅 4 | **deepseek-coder** | **A-** (canonical) / C (exotic) | ~5-8 min | **Canonical patterns**: rate limiters, webhooks, OAuth, auth, CRUD, standard REST | **Exotic composition**: distributed systems, streaming, concurrency primitives |

**`kimi-strict` still not saved** — Round 5 settled it. No advantage over kimi-coder, inherits the GLM 5.1 retry-spiral bug on exotic prompts.

### Combined Round 4+5+6 Scoreboard

| Preset | Rate Limiter | Webhook | CSV | Work Queue | Canonical avg | Exotic avg | Verdict |
|---|---|---|---|---|---|---|---|
| **kimi-coder** | 90 | — | 82 | 82 | 90.0 | **82.0** | 🥇 universal default |
| **qwen-trinity** | 88 | — | 72 | 85 | 88.0 | 78.5 | 🥈 fast, domain-variance |
| **glm-nemotron** | 89 | — | 75 | 76 | 89.0 | 75.5 | 🥉 reliable mid |
| **deepseek-coder** | 90 | **87** | 63¹ | 63¹/76¹ | **88.5** | 69.5 | 🏅 canonical specialist |
| kimi-strict (NEW, unsaved) | — | — | — | 76¹ | — | 76.0 | no niche vs kimi-coder |

¹ = first-pass reviewer score; pipeline marked failed due to retry-spiral bug

**The four-way top tier is now:** kimi-coder (universal), qwen-trinity (fast), glm-nemotron (reliable), deepseek-coder (canonical specialist). Each has a real distinct niche.


