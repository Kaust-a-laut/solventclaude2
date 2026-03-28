# Fluid Gradient Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the beaker fluid gradient (orange -> rose -> purple -> cyan) as a cohesive brand signature across key interaction moments without overwhelming the UI.

**Architecture:** Create 2-3 new CSS utility classes that encapsulate the fluid gradient at different intensities, then apply them surgically to 5 high-visibility touchpoints: navigation indicator, loading skeletons, section dividers, toast accents, and scrollbar thumb. Every usage stays below 0.15 opacity or is confined to thin accent lines (2-4px) so the gradient reads as ambient brand presence, not decoration.

**Tech Stack:** Tailwind CSS, CSS custom properties, framer-motion (existing), Sonner toast (existing)

**Design Principle:** The fluid gradient appears at **signature moments** — places where the user's eye naturally rests during transitions, waiting, and navigation. It never competes with content.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `frontend/src/index.css` | New utility classes: `.fluid-shimmer`, `.fluid-divider`, `.fluid-scrollbar` |
| `frontend/src/components/Navigation.tsx` | Upgrade active tab indicator from solid bar to fluid gradient bar |
| `frontend/src/components/CompareArea.tsx` | Replace gray pulse skeletons with fluid shimmer |
| `frontend/src/components/WaterfallArea.tsx` | Replace gray pulse skeletons with fluid shimmer |
| `frontend/src/main.tsx` | Add fluid gradient left-accent to Sonner toast config |
| `frontend/tailwind.config.js` | Add fluid-gradient scrollbar thumb color stop |

---

### Task 1: Foundation CSS Utility Classes

**Files:**
- Modify: `frontend/src/index.css`

These three classes encapsulate the fluid gradient at different scales so components never inline the gradient colors.

- [ ] **Step 1: Add the `fluid-shimmer` keyframe and class**

Open `frontend/src/index.css`. After the existing `@keyframes liquid-flow` block (around line 295), add:

```css
@keyframes fluid-shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.fluid-shimmer {
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(157, 91, 210, 0.06) 20%,
    rgba(60, 113, 247, 0.08) 40%,
    rgba(6, 182, 212, 0.06) 60%,
    rgba(251, 146, 60, 0.04) 80%,
    transparent 100%
  );
  background-size: 200% 100%;
  animation: fluid-shimmer 2.5s ease-in-out infinite;
}
```

- [ ] **Step 2: Add the `fluid-divider` class**

Directly below the `.fluid-shimmer` block, add:

```css
.fluid-divider {
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(60, 113, 247, 0.15) 20%,
    rgba(157, 91, 210, 0.2) 50%,
    rgba(251, 146, 60, 0.15) 80%,
    transparent 100%
  );
}
```

- [ ] **Step 3: Add the `fluid-scrollbar` class**

Directly below the `.fluid-divider` block, add:

```css
.fluid-scrollbar::-webkit-scrollbar {
  width: 4px;
}

.fluid-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.fluid-scrollbar::-webkit-scrollbar-thumb {
  background: linear-gradient(
    180deg,
    rgba(60, 113, 247, 0.2),
    rgba(157, 91, 210, 0.25),
    rgba(251, 146, 60, 0.2)
  );
  border-radius: 4px;
}

.fluid-scrollbar::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(
    180deg,
    rgba(60, 113, 247, 0.35),
    rgba(157, 91, 210, 0.4),
    rgba(251, 146, 60, 0.35)
  );
}
```

- [ ] **Step 4: Verify classes load**

Run: `cd frontend && npx vite dev`

Open browser DevTools, inspect any element, manually add `fluid-shimmer` class in the Elements panel. Confirm the shimmer animation appears.

- [ ] **Step 5: Commit**

```bash
cd frontend
git add src/index.css
git commit -m "style: add fluid-shimmer, fluid-divider, and fluid-scrollbar utility classes"
```

---

### Task 2: Navigation Active Indicator

**Files:**
- Modify: `frontend/src/components/Navigation.tsx`

The active tab currently shows a solid-color left bar (`via-{color}/80`). Replace it with a fluid gradient bar that cycles through the brand colors.

- [ ] **Step 1: Read the current active indicator code**

Open `frontend/src/components/Navigation.tsx`. Find the active indicator `<div>` — it uses an absolute-positioned gradient bar on the left edge of the active tab. It looks approximately like this:

```tsx
<div className={cn(
  'absolute left-0 top-[20%] bottom-[40%] w-[3px] rounded-full bg-gradient-to-b opacity-90',
  `from-transparent via-${color}/80 to-transparent`
)} />
```

- [ ] **Step 2: Replace with fluid gradient bar**

Replace the active indicator div's className with:

```tsx
<div className="absolute left-0 top-[20%] bottom-[40%] w-[3px] rounded-full opacity-90"
  style={{
    background: 'linear-gradient(180deg, transparent, rgba(60,113,247,0.8), rgba(157,91,210,0.8), rgba(251,146,60,0.6), transparent)',
  }}
/>
```

This gives every active tab the same fluid gradient bar regardless of which tab is selected, creating a consistent brand signature in the navigation.

- [ ] **Step 3: Verify visually**

Click through each navigation tab. Confirm:
- The left indicator bar shows the fluid gradient (blue -> purple -> orange) on every tab
- The bar is 3px wide and sits at the left edge
- It fades to transparent at top and bottom

- [ ] **Step 4: Commit**

```bash
cd frontend
git add src/components/Navigation.tsx
git commit -m "style: upgrade nav active indicator to fluid gradient bar"
```

---

### Task 3: Loading Skeleton Shimmer

**Files:**
- Modify: `frontend/src/components/CompareArea.tsx`
- Modify: `frontend/src/components/WaterfallArea.tsx`

Replace the gray `animate-pulse` skeleton bars with the `fluid-shimmer` class for a branded loading experience.

- [ ] **Step 1: Update CompareArea skeleton (Model A)**

In `frontend/src/components/CompareArea.tsx`, find the Model A skeleton block (approximately lines 171-176):

```tsx
<div className="h-full flex flex-col justify-center gap-4 opacity-20">
    <div className="bg-white/10 animate-pulse rounded-full h-4 w-3/4" />
    <div className="bg-white/10 animate-pulse rounded-full h-4 w-1/2" />
    <div className="bg-white/10 animate-pulse rounded-full h-4 w-5/6" />
    <div className="bg-white/10 animate-pulse rounded-full h-4 w-2/3" />
</div>
```

Replace with:

```tsx
<div className="h-full flex flex-col justify-center gap-4">
    <div className="fluid-shimmer rounded-full h-4 w-3/4" />
    <div className="fluid-shimmer rounded-full h-4 w-1/2" style={{ animationDelay: '0.3s' }} />
    <div className="fluid-shimmer rounded-full h-4 w-5/6" style={{ animationDelay: '0.6s' }} />
    <div className="fluid-shimmer rounded-full h-4 w-2/3" style={{ animationDelay: '0.9s' }} />
</div>
```

- [ ] **Step 2: Update CompareArea skeleton (Model B)**

Find the identical skeleton block for Model B (approximately lines 208-214) and apply the same replacement as Step 1.

- [ ] **Step 3: Update WaterfallArea initializing dots**

In `frontend/src/components/WaterfallArea.tsx`, find the "Initializing Pipeline..." text (inside the `isInitializing` block). Below the pulsing dots, add three fluid shimmer bars to fill the empty space:

After the existing `<span>` that says "Initializing Pipeline...", add:

```tsx
<div className="flex flex-col gap-3 w-64 mt-4">
    <div className="fluid-shimmer rounded-full h-2 w-full" />
    <div className="fluid-shimmer rounded-full h-2 w-4/5" style={{ animationDelay: '0.4s' }} />
    <div className="fluid-shimmer rounded-full h-2 w-3/5" style={{ animationDelay: '0.8s' }} />
</div>
```

- [ ] **Step 4: Verify visually**

Open Compare page — before submitting a comparison, confirm the skeleton placeholders show the flowing gradient shimmer instead of gray pulse. Open Waterfall page — submit a prompt and watch the initializing state for shimmer bars.

- [ ] **Step 5: Commit**

```bash
cd frontend
git add src/components/CompareArea.tsx src/components/WaterfallArea.tsx
git commit -m "style: replace gray pulse skeletons with fluid gradient shimmer"
```

---

### Task 4: Toast Left-Accent

**Files:**
- Modify: `frontend/src/main.tsx`

Add a fluid gradient left border to all Sonner toasts so notifications carry the brand signature.

- [ ] **Step 1: Read current Toaster config**

Open `frontend/src/main.tsx`. Find the `<Toaster>` component that was added in Task 9 of the previous plan. It currently has:

```tsx
<Toaster
  theme="dark"
  position="bottom-right"
  toastOptions={{
    style: {
      background: 'rgba(23, 23, 23, 0.95)',
      border: '1px solid rgba(255, 255, 255, 0.06)',
      color: '#e5e5e5',
      backdropFilter: 'blur(12px)',
    },
  }}
/>
```

- [ ] **Step 2: Add fluid gradient left border**

Update the `style` object to include a left border image:

```tsx
<Toaster
  theme="dark"
  position="bottom-right"
  toastOptions={{
    style: {
      background: 'rgba(23, 23, 23, 0.95)',
      border: '1px solid rgba(255, 255, 255, 0.06)',
      borderLeft: '3px solid transparent',
      borderImage: 'linear-gradient(180deg, rgba(60,113,247,0.6), rgba(157,91,210,0.6), rgba(251,146,60,0.5)) 1',
      color: '#e5e5e5',
      backdropFilter: 'blur(12px)',
    },
  }}
/>
```

- [ ] **Step 3: Verify visually**

Trigger a toast notification (e.g., by using the app in a way that generates one, or temporarily add `toast('Test notification')` in a useEffect). Confirm the left edge shows the fluid gradient stripe.

- [ ] **Step 4: Commit**

```bash
cd frontend
git add src/main.tsx
git commit -m "style: add fluid gradient left-accent to Sonner toasts"
```

---

### Task 5: Fluid Scrollbar on Primary Panels

**Files:**
- Modify: `frontend/src/components/HomeArea.tsx`
- Modify: `frontend/src/components/WaterfallArea.tsx`
- Modify: `frontend/src/components/CompareArea.tsx`

Apply the `fluid-scrollbar` class to the main scrollable panels so the scrollbar thumb picks up the brand gradient.

- [ ] **Step 1: Update HomeArea**

In `frontend/src/components/HomeArea.tsx`, find the outermost scrollable div (the one with `overflow-y-scroll scrollbar-thin`). Add `fluid-scrollbar` to its className:

```tsx
<div className="absolute inset-0 overflow-y-scroll scrollbar-thin fluid-scrollbar p-6 md:p-10 lg:p-12 pt-2 md:pt-4 lg:pt-6">
```

- [ ] **Step 2: Update WaterfallArea**

In `frontend/src/components/WaterfallArea.tsx`, find the left column scrollable div (the one with `overflow-y-scroll scrollbar-thin`). Add `fluid-scrollbar`:

```tsx
'flex flex-col gap-6 overflow-y-scroll scrollbar-thin fluid-scrollbar transition-all duration-500',
```

- [ ] **Step 3: Update CompareArea**

In `frontend/src/components/CompareArea.tsx`, find the outermost scrollable div (the one with `overflow-y-auto scrollbar-thin`). Add `fluid-scrollbar`:

```tsx
"flex flex-col h-full bg-black/20 backdrop-blur-3xl overflow-y-auto scrollbar-thin fluid-scrollbar transition-all duration-500",
```

- [ ] **Step 4: Verify visually**

Scroll each panel. Confirm:
- The scrollbar thumb shows the fluid gradient (blue -> purple -> orange, vertical)
- It's 4px wide and subtle
- On hover, the gradient brightens slightly
- It doesn't conflict with existing scrollbar-thin styling

- [ ] **Step 5: Commit**

```bash
cd frontend
git add src/components/HomeArea.tsx src/components/WaterfallArea.tsx src/components/CompareArea.tsx
git commit -m "style: apply fluid gradient scrollbar to primary panels"
```

---

### Task 6: Section Dividers on Home Page

**Files:**
- Modify: `frontend/src/components/HomeArea.tsx`

Add a `fluid-divider` between the hero section and the bento grid to visually separate the two zones with a brand-colored hair line.

- [ ] **Step 1: Add divider between hero and bento grid**

In `frontend/src/components/HomeArea.tsx`, find the closing `</div>` of the hero section (the `relative z-10` div). Directly after it, before the bento grid `<div className="grid ...">`, add:

```tsx
<div className="fluid-divider rounded-full my-2" />
```

- [ ] **Step 2: Verify visually**

Open the home page. Confirm:
- A 1px gradient line appears between the hero and the feature grid
- It fades to transparent at both horizontal ends
- It's subtle — visible but not attention-grabbing

- [ ] **Step 3: Commit**

```bash
cd frontend
git add src/components/HomeArea.tsx
git commit -m "style: add fluid-divider between hero and bento grid on home page"
```

---

### Task 7: Visual Verification & TypeScript Check

**Files:** None (verification only)

- [ ] **Step 1: Run TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: Exit 0, zero errors.

- [ ] **Step 2: Run Vite build**

```bash
cd frontend && npx vite build --mode development
```

Expected: Build succeeds (Node 20+).

- [ ] **Step 3: Full visual walkthrough**

Open the app at `localhost:5173` and check each touchpoint:

| Location | What to check |
|----------|---------------|
| Navigation sidebar | Fluid gradient left bar on active tab |
| Home page | Fluid divider between hero and grid, fluid scrollbar on scroll |
| Compare page | Fluid shimmer skeletons (before submitting), fluid scrollbar |
| Waterfall page | Fluid shimmer in initializing state, fluid scrollbar on left panel |
| Any toast | Fluid gradient left accent stripe |

Confirm nothing is too bright, too distracting, or visually broken.

- [ ] **Step 4: Commit any fixes**

If any visual issues are found, fix and commit with a descriptive message.
