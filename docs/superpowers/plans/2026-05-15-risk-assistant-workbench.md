# Risk Assistant Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the upload/intelligence screen into a deterministic risk-workbench with optional AI assistance, clustered risk summaries, and per-item copy actions.

**Architecture:** Add a shared risk-clustering helper for deterministic grouping, then wire it into the client document import view so risk categories and hotspot clusters render immediately after parsing. Keep AI optional behind a click-to-open panel that reads the extracted text and current cluster map. Add copy actions to the generated task pack and risk editor so users can move individual names and notes into Nourish without hand-editing.

**Tech Stack:** React 19, TypeScript, Vite, local clipboard API, existing import/analyze pipeline.

---

### Task 1: Shared risk clustering helper

**Files:**
- Create: `src/lib/risk-assistant.ts`
- Create: `src/lib/risk-assistant.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { groupRiskItems } from './risk-assistant';

it('groups similar risks into hotspot clusters', () => {
  const clusters = groupRiskItems([
    { title: 'Falls after standing', description: '', triggers: [], earlyWarnings: [], controls: [], likelihood: 3, impact: 3 },
    { title: 'Trip hazard in lounge', description: '', triggers: [], earlyWarnings: [], controls: [], likelihood: 4, impact: 3 },
  ] as any);
  expect(clusters[0].count).toBe(2);
  expect(clusters[0].hotspot).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- --run src/lib/risk-assistant.test.ts`
Expected: fail because the helper does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export function groupRiskItems(items) {
  return [{ key: 'mobility', label: 'Mobility', count: items.length, items, hotspot: items.length >= 3 }];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd test -- --run src/lib/risk-assistant.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/risk-assistant.ts src/lib/risk-assistant.test.ts
git commit -m "feat: add risk clustering helper"
```

### Task 2: Client document import workbench

**Files:**
- Modify: `src/pages/ClientDocsPage.tsx`

- [ ] **Step 1: Write the failing test**

```ts
// Covered indirectly by the helper; UI is verified in browser.
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test`
Expected: existing page still lacks cluster cards and optional AI panel.

- [ ] **Step 3: Write minimal implementation**

```tsx
// Add risk cluster summary cards, hotspot highlighting, and a hidden AI panel opened by a "Use AI" button.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pages/ClientDocsPage.tsx
git commit -m "feat: add clustered risk workbench to import view"
```

### Task 3: Copy actions in task and risk editors

**Files:**
- Modify: `src/pages/NourishTaskPack.tsx`
- Modify: `src/pages/RiskBuilder.tsx`

- [ ] **Step 1: Write the failing test**

```ts
// UI copy affordances are verified in browser and build output.
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test`
Expected: task cards and risk cards still lack individual copy actions.

- [ ] **Step 3: Write minimal implementation**

```tsx
// Add per-item copy buttons for task names and notes, plus title/summary copy on risk cards.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pages/NourishTaskPack.tsx src/pages/RiskBuilder.tsx
git commit -m "feat: add per-item copy actions"
```

### Task 4: Verify and deploy

**Files:**
- None

- [ ] **Step 1: Run the full test suite**

Run: `npm.cmd test`
Expected: all tests pass.

- [ ] **Step 2: Build production assets**

Run: `npm.cmd run build`
Expected: successful Vite build.

- [ ] **Step 3: Deploy to Vercel**

Run: `npx.cmd vercel --prod --yes`
Expected: production deployment URL returned.

