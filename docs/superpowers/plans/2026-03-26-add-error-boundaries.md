# Add Error Boundaries to New Components Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a reusable ErrorBoundary component and wrap MissionDashboard, GlobalSearch, and SupervisorHistory components with error handling.

**Architecture:** Single ErrorBoundary class component (required for error boundaries in React) with customizable fallback and onError callback. Wrap each new component at the export level.

**Tech Stack:** React 18, TypeScript, lucide-react icons

---

### Task 1: Create ErrorBoundary Component

**Files:**
- Create: `frontend/src/components/ErrorBoundary.tsx`

- [ ] **Step 1: Create ErrorBoundary component**

```typescript
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex items-center justify-center p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl">
          <AlertTriangle size={16} className="text-rose-400 mr-2" />
          <span className="text-[10px] text-rose-300">Something went wrong</span>
        </div>
      );
    }

    return this.props.children;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/ErrorBoundary.tsx
git commit -m "feat: create reusable ErrorBoundary component"
```

---

### Task 2: Wrap MissionDashboard with ErrorBoundary

**Files:**
- Modify: `frontend/src/components/MissionDashboard.tsx`

- [ ] **Step 1: Add ErrorBoundary import and wrap component**

Add import at top:
```typescript
import { ErrorBoundary } from './ErrorBoundary';
```

Wrap the entire return statement in the component with ErrorBoundary:
```typescript
return (
  <ErrorBoundary>
    <div className="fixed top-4 right-4 z-40 w-80">
      {/* ... existing content ... */}
    </div>
  </ErrorBoundary>
);
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/MissionDashboard.tsx
git commit -m "feat: wrap MissionDashboard with ErrorBoundary"
```

---

### Task 3: Add Error Handling to GlobalSearch

**Files:**
- Modify: `frontend/src/components/GlobalSearch.tsx`

- [ ] **Step 1: Add error state and error UI**

Add error state after existing states:
```typescript
const [error, setError] = useState<string | null>(null);
```

Update `performSearch` catch block:
```typescript
} catch (error) {
  console.error('[GlobalSearch] Search failed:', error);
  setError(error instanceof Error ? error.message : 'Search failed');
}
```

Add error UI in the results section (after isLoading check):
```typescript
{error ? (
  <div className="p-8 text-center">
    <AlertTriangle size={24} className="text-rose-500 mx-auto mb-2" />
    <p className="text-[10px] text-rose-400 uppercase tracking-widest">Search Error</p>
    <p className="text-[8px] text-slate-500 mt-1">{error}</p>
    <button
      onClick={() => { setError(null); setQuery(''); }}
      className="mt-3 px-3 py-1.5 bg-rose-500/20 border border-rose-500/30 rounded-lg text-[9px] text-rose-300 hover:bg-rose-500/30 transition-all"
    >
      Try Again
    </button>
  </div>
) : isLoading ? (
  // ... existing loading state
```

Add AlertTriangle import:
```typescript
import { AlertTriangle, Search, MessageSquare, FileText, Brain, History, ... } from 'lucide-react';
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/GlobalSearch.tsx
git commit -m "feat: add error state and UI to GlobalSearch"
```

---

### Task 4: Wrap SupervisorHistory with ErrorBoundary

**Files:**
- Modify: `frontend/src/components/SupervisorHistory.tsx`

- [ ] **Step 1: Add ErrorBoundary import and wrap component**

Add import at top:
```typescript
import { ErrorBoundary } from './ErrorBoundary';
```

Wrap the main return statement (the motion.div) with ErrorBoundary:
```typescript
return (
  <ErrorBoundary>
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4"
    >
      {/* ... existing content ... */}
    </motion.div>
  </ErrorBoundary>
);
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/SupervisorHistory.tsx
git commit -m "feat: wrap SupervisorHistory with ErrorBoundary"
```

---

### Task 5: Verify and Final Commit

**Files:**
- All modified component files

- [ ] **Step 1: Run frontend tests**

```bash
npm test --prefix frontend
```

Expected: All tests pass

- [ ] **Step 2: Create final squash commit if needed**

If multiple commits were created, they can be squashed:
```bash
git add frontend/src/components/ErrorBoundary.tsx frontend/src/components/MissionDashboard.tsx frontend/src/components/GlobalSearch.tsx frontend/src/components/SupervisorHistory.tsx
git commit -m "feat: add error boundaries to new components"
```

---

## Self-Review Checklist

- [ ] ErrorBoundary component created with proper TypeScript types
- [ ] MissionDashboard wrapped with ErrorBoundary
- [ ] GlobalSearch has error state and error UI
- [ ] SupervisorHistory wrapped with ErrorBoundary
- [ ] All frontend tests still pass
- [ ] Commit created
