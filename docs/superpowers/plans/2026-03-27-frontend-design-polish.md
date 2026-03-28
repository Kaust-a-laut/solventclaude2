# Frontend Design Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elevate the Solvent AI frontend from "experimental sci-fi tool" to "professional AI workspace with sci-fi soul" through targeted typography, contrast, animation, and component fixes.

**Architecture:** Direct modifications to existing Tailwind config and CSS, regex-driven typography migration across 90+ components, two new reusable components (`EmptyState`, `Card`), and Sonner toast integration. No new abstraction layers or token files — Tailwind IS the token system.

**Tech Stack:** React 18 + TypeScript, Tailwind CSS 3.4, Framer Motion, Sonner (new), Lucide React

**Supersedes:** `docs/superpowers/plans/frontend-design-analysis-and-plan.md` (original 5-week plan, condensed here to ~4 hours of focused work)

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `frontend/tailwind.config.js` | Modify | Add accent color scales, bump border opacity, fix animation timing |
| `frontend/src/index.css` | Modify | Update glass-panel border, fix chat-bubble-ai text, update technical-meta |
| `frontend/src/components/AuraBackground.tsx` | Modify | Speed up blob animation |
| `frontend/src/components/ui/Card.tsx` | Create | Standardized glass card component |
| `frontend/src/components/ui/EmptyState.tsx` | Create | Reusable empty state with icon, title, description, action |
| `frontend/src/components/ui/index.ts` | Create | Barrel export for ui components |
| `frontend/src/App.tsx` | Modify | Add Sonner Toaster provider |
| `frontend/src/components/**/*.tsx` | Modify | Typography migration (sub-11px -> 11px minimum) |
| `frontend/src/components/MessageList.tsx` | Modify | Use new EmptyState component |

---

### Task 1: Accent Color Scales + Border Opacity in Tailwind Config

**Files:**
- Modify: `frontend/tailwind.config.js`

This task adds 400/500/600/glow variants for each accent color (enabling hover/disabled/emphasis states) and bumps the default border opacity from 0.03 to 0.06.

- [ ] **Step 1: Read the current tailwind.config.js**

Read `frontend/tailwind.config.js` fully to understand the current structure before modifying.

- [ ] **Step 2: Replace the jb color block with expanded scales**

In `frontend/tailwind.config.js`, find the `jb` object inside `colors` and replace it with:

```javascript
jb: {
  dark: '#020205',
  panel: '#050508',
  hover: '#12141C',
  border: 'rgba(255, 255, 255, 0.06)',  // Was 0.03 — too invisible on most displays
  text: '#C0C2C8',
  accent: '#3C71F7',
  'accent-400': '#5B8AF9',
  'accent-600': '#1d4ed8',
  'accent-glow': 'rgba(60,113,247,0.3)',
  purple: '#9D5BD2',
  'purple-400': '#B47DE0',
  'purple-600': '#6d28d9',
  'purple-glow': 'rgba(157,91,210,0.3)',
  orange: '#FB923C',
  'orange-400': '#FDAE6B',
  'orange-600': '#ea580c',
  'orange-glow': 'rgba(251,146,60,0.3)',
  cyan: '#06B6D4',
  'cyan-400': '#22D3EE',
  'cyan-600': '#0e7490',
  'cyan-glow': 'rgba(6,182,212,0.3)',
},
```

- [ ] **Step 3: Fix animation timing**

In the same file, find the `animation` object and update:

```javascript
animation: {
  'blob': 'blob 12s infinite',           // Was 25s — felt frozen
  'slow-spin': 'spin 20s linear infinite', // Was 40s — too sluggish
  'border-flow': 'border-flow 3s linear infinite', // Was 4s
},
```

- [ ] **Step 4: Verify the config is valid**

Run: `cd /home/caleb/solventclaude2/dazzling-shirley/frontend && npx tailwindcss --content 'src/**/*.tsx' --output /dev/null 2>&1 | head -5`
Expected: No errors (may show warnings about content, that's fine)

- [ ] **Step 5: Commit**

```bash
git add frontend/tailwind.config.js
git commit -m "style: add accent color scales, bump border opacity, fix animation timing"
```

---

### Task 2: Update CSS Glass Panel + Technical Meta Styles

**Files:**
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Update glass-panel border opacity**

In `frontend/src/index.css`, find the `.glass-panel` class (around line 119-120) and change:

```css
/* OLD */
@apply bg-black/20 backdrop-blur-3xl border border-white/[0.03] shadow-2xl relative overflow-hidden;

/* NEW */
@apply bg-black/20 backdrop-blur-3xl border border-white/[0.06] shadow-2xl relative overflow-hidden;
```

- [ ] **Step 2: Update glass-card border opacity**

Find `.glass-card` (around line 131) and change `border-white/[0.03]` to `border-white/[0.06]`.

- [ ] **Step 3: Update technical-meta minimum size**

Find `.technical-meta` (around line 189-191) and change:

```css
/* OLD */
.technical-meta {
  @apply font-mono text-[10px] uppercase tracking-widest text-white/30;
}

/* NEW */
.technical-meta {
  @apply font-mono text-[11px] uppercase tracking-widest text-white/30;
}
```

- [ ] **Step 4: Verify the CSS compiles**

Run: `cd /home/caleb/solventclaude2/dazzling-shirley/frontend && npx vite build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add frontend/src/index.css
git commit -m "style: bump glass panel border opacity and technical-meta minimum size"
```

---

### Task 3: Speed Up AuraBackground Animation

**Files:**
- Modify: `frontend/src/components/AuraBackground.tsx`

- [ ] **Step 1: Read AuraBackground.tsx**

Read the file to find the `aura-organic-pulse` keyframe and its timing.

- [ ] **Step 2: Update the animation duration**

Find the CSS-in-JS or inline style block with `aura-organic-pulse` (around line 11-26) and change the animation duration from `25s` to `12s`:

```css
.aura-mesh-container {
  animation: aura-organic-pulse 12s infinite ease-in-out;  /* Was 25s */
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/AuraBackground.tsx
git commit -m "style: speed up aura background animation 25s -> 12s"
```

---

### Task 4: Typography Migration — Sub-11px Text

**Files:**
- Modify: All `frontend/src/components/**/*.tsx` files (628 instances across ~50+ files)

This is the biggest task. We replace all arbitrary text sizes below 11px with standardized sizes. The mapping:

| Old | New | Rationale |
|-----|-----|-----------|
| `text-[7px]` | `text-[11px]` | 7px is unreadable |
| `text-[8px]` | `text-[11px]` | 8px is unreadable |
| `text-[9px]` | `text-[11px]` | 9px strains eyes |
| `text-[10px]` | `text-[11px]` | Bump to minimum |
| `text-[15.5px]` | `text-[15px]` | Normalize fractional |

We do NOT change `text-[11px]` (already at minimum), `text-[13px]`, `text-[14px]`, or `text-[16px]` — those are fine. We also keep `text-[15.5px]` close to its original (15px, not 14px) because AI message text should be slightly larger than body for readability.

- [ ] **Step 1: Run the migration script**

```bash
cd /home/caleb/solventclaude2/dazzling-shirley/frontend

# Replace sub-11px text sizes with 11px minimum
find src/components -name "*.tsx" -exec sed -i \
  -e 's/text-\[7px\]/text-[11px]/g' \
  -e 's/text-\[8px\]/text-[11px]/g' \
  -e 's/text-\[9px\]/text-[11px]/g' \
  -e 's/text-\[10px\]/text-[11px]/g' \
  -e 's/text-\[15\.5px\]/text-[15px]/g' \
  {} \;
```

- [ ] **Step 2: Also fix any in index.css**

The `.chat-bubble-ai` class in `frontend/src/index.css` uses `text-[15.5px]`. Update to `text-[15px]`.

- [ ] **Step 3: Verify no sub-11px text remains**

Run: `grep -rn 'text-\[7px\]\|text-\[8px\]\|text-\[9px\]\|text-\[10px\]' frontend/src/components/`
Expected: No matches

- [ ] **Step 4: Verify build still succeeds**

Run: `cd /home/caleb/solventclaude2/dazzling-shirley/frontend && npx vite build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add frontend/src/
git commit -m "style: enforce 11px minimum text size across all components (628 instances)"
```

---

### Task 5: Inline Border Opacity Migration

**Files:**
- Modify: `frontend/src/components/coding/CodingTerminal.tsx`
- Modify: `frontend/src/components/ModelPlaygroundArea.tsx`
- Modify: `frontend/src/components/WaterfallVisualizer.tsx`
- Modify: `frontend/src/components/HomeArea.tsx`

Four components use inline `border-white/[0.03]` outside of the glass-panel class. Update them all.

- [ ] **Step 1: Run sed replacement**

```bash
cd /home/caleb/solventclaude2/dazzling-shirley/frontend
find src/components -name "*.tsx" -exec sed -i \
  's/border-white\/\[0\.03\]/border-white\/[0.06]/g' \
  {} \;
```

- [ ] **Step 2: Verify no 0.03 borders remain in components**

Run: `grep -rn 'border-white/\[0\.03\]' frontend/src/components/`
Expected: No matches

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/
git commit -m "style: bump inline border opacity 0.03 -> 0.06 in 4 components"
```

---

### Task 6: Create Card Component

**Files:**
- Create: `frontend/src/components/ui/Card.tsx`
- Create: `frontend/src/components/ui/index.ts`

Standardized glass card component that replaces ad-hoc `glass-panel` div patterns.

- [ ] **Step 1: Create the ui directory**

```bash
mkdir -p /home/caleb/solventclaude2/dazzling-shirley/frontend/src/components/ui
```

- [ ] **Step 2: Create Card.tsx**

Create `frontend/src/components/ui/Card.tsx`:

```tsx
import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'glass';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

const paddingMap = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
} as const;

const variantMap = {
  default: 'bg-white/[0.02] border border-white/[0.06] rounded-xl',
  elevated: 'bg-white/[0.04] border border-white/[0.08] rounded-xl shadow-lg',
  glass: 'glass-panel rounded-xl',
} as const;

export function Card({
  variant = 'default',
  padding = 'md',
  className = '',
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={`${variantMap[variant]} ${paddingMap[padding]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Create barrel export**

Create `frontend/src/components/ui/index.ts`:

```typescript
export { Card } from './Card';
```

- [ ] **Step 4: Verify it compiles**

Run: `cd /home/caleb/solventclaude2/dazzling-shirley/frontend && npx tsc --noEmit 2>&1 | head -10`
Expected: No errors (or pre-existing errors only)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ui/
git commit -m "feat: add Card component with default/elevated/glass variants"
```

---

### Task 7: Create EmptyState Component

**Files:**
- Create: `frontend/src/components/ui/EmptyState.tsx`
- Modify: `frontend/src/components/ui/index.ts`

Reusable empty state with icon, title, description, optional action button, and optional keyboard shortcuts.

- [ ] **Step 1: Create EmptyState.tsx**

Create `frontend/src/components/ui/EmptyState.tsx`:

```tsx
import React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  accentColor?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  shortcuts?: Array<{
    key: string;
    label: string;
  }>;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  accentColor = 'jb-accent',
  action,
  shortcuts,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="flex-1 flex flex-col items-center justify-center gap-5 py-20 pointer-events-auto select-none"
    >
      <div className="relative">
        <div className={`w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center`}>
          <Icon className={`w-6 h-6 text-${accentColor}/60`} />
        </div>
      </div>

      <div className="flex flex-col items-center gap-2 max-w-xs text-center">
        <p className="text-sm font-semibold text-slate-300">{title}</p>
        <p className="text-[13px] text-slate-500 leading-relaxed">{description}</p>
      </div>

      {action && (
        <button
          onClick={action.onClick}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium
            bg-${accentColor}/10 border border-${accentColor}/20 text-${accentColor}
            hover:bg-${accentColor}/15 hover:border-${accentColor}/30
            transition-all duration-200`}
        >
          {action.icon && <action.icon className="w-4 h-4" />}
          {action.label}
        </button>
      )}

      {shortcuts && shortcuts.length > 0 && (
        <div className="flex flex-wrap gap-3 mt-2">
          {shortcuts.map((s) => (
            <div key={s.key} className="flex items-center gap-2 text-[11px] text-slate-600">
              <kbd className="font-mono px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.08] text-slate-500">
                {s.key}
              </kbd>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
```

- [ ] **Step 2: Update barrel export**

In `frontend/src/components/ui/index.ts`, add:

```typescript
export { Card } from './Card';
export { EmptyState } from './EmptyState';
```

- [ ] **Step 3: Verify it compiles**

Run: `cd /home/caleb/solventclaude2/dazzling-shirley/frontend && npx tsc --noEmit 2>&1 | head -10`
Expected: No errors (or pre-existing errors only)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ui/
git commit -m "feat: add EmptyState component with icon, action, and shortcuts support"
```

---

### Task 8: Wire EmptyState into MessageList

**Files:**
- Modify: `frontend/src/components/MessageList.tsx`

Replace the inline empty state in MessageList with the new EmptyState component.

- [ ] **Step 1: Read current MessageList.tsx**

Read `frontend/src/components/MessageList.tsx` to understand the current empty state block (around lines 60-74).

- [ ] **Step 2: Add import**

Add to the imports at the top of the file:

```typescript
import { EmptyState } from './ui/EmptyState';
import { MessageCircle } from 'lucide-react';
```

Note: Check if `MessageCircle` or similar icon is already imported. If `lucide-react` is already imported, just add `MessageCircle` to the existing import.

- [ ] **Step 3: Replace the inline empty state**

Find the block that renders when `messages.length === 0 && !isProcessing` and replace it with:

```tsx
{messages.length === 0 && !isProcessing && (
  <EmptyState
    icon={MessageCircle}
    title="Ready when you are"
    description="Ask a question, share an idea, or drop in a file to get started."
  />
)}
```

- [ ] **Step 4: Verify it compiles**

Run: `cd /home/caleb/solventclaude2/dazzling-shirley/frontend && npx tsc --noEmit 2>&1 | head -10`
Expected: No errors (or pre-existing errors only)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/MessageList.tsx
git commit -m "refactor: use EmptyState component in MessageList"
```

---

### Task 9: Install and Wire Sonner Toast System

**Files:**
- Modify: `frontend/package.json` (via npm install)
- Modify: `frontend/src/App.tsx` (or root component that wraps the app)

- [ ] **Step 1: Install Sonner**

```bash
cd /home/caleb/solventclaude2/dazzling-shirley/frontend && npm install sonner
```

- [ ] **Step 2: Read the root App component**

Read the main app entry to understand where to add the Toaster. Check `frontend/src/App.tsx` or `frontend/src/main.tsx` — whichever renders the root layout.

- [ ] **Step 3: Add Toaster to the root component**

Add the import:

```typescript
import { Toaster } from 'sonner';
```

Add `<Toaster />` as a sibling to the main content, just before the closing fragment/div:

```tsx
<Toaster
  position="bottom-right"
  toastOptions={{
    style: {
      background: '#121214',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      color: '#e2e2e5',
      fontFamily: 'Inter Tight, Inter, sans-serif',
      fontSize: '13px',
    },
  }}
/>
```

- [ ] **Step 4: Verify it compiles and Sonner is importable**

Run: `cd /home/caleb/solventclaude2/dazzling-shirley/frontend && npx tsc --noEmit 2>&1 | head -10`
Expected: No errors (or pre-existing errors only)

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/App.tsx
git commit -m "feat: add Sonner toast notification system"
```

Note: Adjust the `git add` path if the Toaster was added to a different file than `App.tsx`.

---

### Task 10: Visual Verification

**Files:** None (verification only)

- [ ] **Step 1: Start the frontend dev server**

```bash
cd /home/caleb/solventclaude2/dazzling-shirley/frontend && npm run dev
```

- [ ] **Step 2: Visual checks**

Open the app in a browser and verify:

1. **Glass panels** have visible borders (not invisible)
2. **All text** is readable — no squinting at tiny labels
3. **Background aura** moves noticeably (not frozen-looking)
4. **Chat empty state** shows the new EmptyState component
5. **No layout breakage** — the typography size bump may cause some elements to overflow. Check:
   - NotepadPiP (heaviest user of micro-text)
   - TitleBar
   - MessageItem metadata/badges
   - Navigation sidebar

- [ ] **Step 3: Fix any overflow/layout issues from typography migration**

If any elements overflow due to the 11px minimum, adjust their container widths or use `truncate` / `overflow-hidden` classes as needed. Common fixes:
- Badges: may need `whitespace-nowrap truncate max-w-[120px]`
- Sidebar labels: may need `truncate`

- [ ] **Step 4: Final commit if any layout fixes were needed**

```bash
git add -A
git commit -m "fix: adjust layouts for 11px minimum typography"
```
