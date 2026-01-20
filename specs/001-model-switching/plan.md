# Implementation Plan: Model Switching

**Branch**: `001-model-switching` | **Date**: 2026-01-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-model-switching/spec.md`

## Summary

Add the ability to switch between AI models (Claude 3.5 Sonnet, GPT-4o, Sonar, etc.) via the Perplexity UI model selector dropdown. The implementation adds a `switchModel()` function to puppeteer utilities and an optional `model` parameter to `search` and `chat_perplexity` tools. When `model` is provided, the system opens the dropdown, finds the matching model (case-insensitive), and selects it before executing the query.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 18+  
**Primary Dependencies**: puppeteer-extra, puppeteer-extra-plugin-stealth, Zod (schema validation)  
**Storage**: SQLite via better-sqlite3 (existing chat history)  
**Testing**: Vitest (unit + integration)  
**Target Platform**: Node.js MCP server with browser automation  
**Project Type**: Single MCP server project  
**Performance Goals**: Model switch completes in <3 seconds (SC-001)  
**Constraints**: 5-second timeout for dropdown options (FR-004), backward compatible when `model` omitted (FR-008)  
**Scale/Scope**: Single-user local MCP server, sequential operations

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| Test-First (TDD) | ✅ PASS | Unit tests for `switchModel()` logic, integration tests for full flow |
| CLI Interface (text I/O) | ✅ PASS | Tools return text; errors go to stderr via existing logging |
| Library-First | ✅ PASS | Core `switchModel()` is a pure utility; tools compose it |
| Integration Testing | ✅ PASS | Contract tests for model parameter schema; E2E for browser interactions |
| Observability | ✅ PASS | Uses existing `logInfo`/`logError` logging utilities |
| Simplicity | ✅ PASS | Minimal change: 1 new function, 2 modified tools, 1 new schema field |

**Gate Result**: ✅ PROCEED to Phase 0

## Project Structure

### Documentation (this feature)

```text
specs/001-model-switching/
├── plan.md              # This file
├── research.md          # Phase 0 output (selector discovery)
├── data-model.md        # Phase 1 output (ModelSwitchResult type)
├── quickstart.md        # Phase 1 output (usage examples)
├── contracts/           # Phase 1 output (updated tool schemas)
└── tasks.md             # Phase 2 output (task breakdown)
```

### Source Code (repository root)

```text
src/
├── utils/
│   ├── puppeteer.ts          # ADD: switchModel() function
│   └── puppeteer-logic.ts    # ADD: MODEL_SELECTORS constant, helper logic
├── tools/
│   ├── chatPerplexity.ts     # MODIFY: Add optional model parameter
│   └── search.ts             # MODIFY: Add optional model parameter
├── types/
│   ├── browser.ts            # ADD: ModelSwitchResult type
│   └── tools.ts              # MODIFY: Add model to SearchArgs, ChatPerplexityArgs
├── schema/
│   └── toolSchemas.ts        # MODIFY: Add model property to schemas
└── __tests__/
    ├── unit/
    │   ├── model-switching.test.ts    # NEW: Pure logic tests
    │   └── tools.test.ts              # MODIFY: Add model param tests
    └── integration/
        └── model-switching.test.ts    # NEW: Browser integration tests
```

**Structure Decision**: Single project structure maintained. New functionality added to existing `utils/puppeteer.ts` following the established pattern of `openPerplexityChat()` and `openPerplexitySpace()`.

## Complexity Tracking

> No constitution violations. Minimal complexity added.

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| New exports | 0 | 2 | +2 (`switchModel`, `MODEL_SELECTORS`) |
| Modified functions | 0 | 2 | +2 (search, chatPerplexity) |
| New types | 0 | 1 | +1 (`ModelSwitchResult`) |
| New test files | 0 | 2 | +2 |

---

## Phase 0: Research

### Research Tasks

| ID | Question | Status |
|----|----------|--------|
| R01 | What are the current Perplexity UI selectors for model dropdown? | PENDING |
| R02 | What models are available in Perplexity Pro? | PENDING |
| R03 | What is the dropdown interaction pattern (click-to-open, options load async)? | PENDING |
| R04 | How do existing functions handle selector fallbacks? | RESOLVED - see `getSearchInputSelectors()` |

### Findings

**R04 - Selector Fallback Pattern** (from `puppeteer-logic.ts`):
```typescript
export function getSearchInputSelectors(): string[] {
  return [
    'textarea[placeholder*="Ask"]',
    'textarea[placeholder*="Search"]',
    // ... multiple fallbacks
  ];
}
```
→ Apply same pattern for MODEL_SELECTORS

**Deliverable**: `research.md` with R01-R03 findings populated after UI inspection.

---

## Phase 1: Design & Contracts

### 1.1 Data Model

**File**: `src/types/browser.ts` (add export)

```typescript
export interface ModelSwitchResult {
  success: boolean;
  selectedModel: string;
  previousModel?: string;
  duration: number; // milliseconds
}
```

**File**: `src/types/tools.ts` (modify existing)

```typescript
// ADD to existing SearchArgs
export interface SearchArgs {
  query: string;
  detail_level?: "brief" | "normal" | "detailed";
  stream?: boolean;
  space_id?: string;
  model?: string; // NEW
}

// ADD to existing ChatPerplexityArgs
export interface ChatPerplexityArgs {
  message: string;
  chat_id?: string;
  chat_url?: string;
  space_id?: string;
  model?: string; // NEW
}
```

### 1.2 API Contracts

**File**: `src/schema/toolSchemas.ts` (modify existing)

Add to `chat_perplexity` inputSchema.properties:
```json
{
  "model": {
    "type": "string",
    "description": "Optional: AI model to use for this query. Case-insensitive matching. If not provided, uses the currently-selected model in Perplexity.",
    "examples": ["Claude 3.5 Sonnet", "GPT-4o", "Sonar"]
  }
}
```

Add to `search` inputSchema.properties:
```json
{
  "model": {
    "type": "string",
    "description": "Optional: AI model to use for this search. Case-insensitive matching. If not provided, uses the currently-selected model in Perplexity.",
    "examples": ["Claude 3.5 Sonnet", "GPT-4o", "Sonar"]
  }
}
```

### 1.3 Core Function Signature

**File**: `src/utils/puppeteer.ts`

```typescript
/**
 * Switch to a specific AI model in the Perplexity dropdown.
 * Uses multiple selector patterns for resilience (FR-002).
 * Matches model names case-insensitively (FR-003).
 *
 * @param ctx - The Puppeteer context with initialized page
 * @param modelName - The model name to select (e.g., "Claude 3.5 Sonnet")
 * @returns ModelSwitchResult with success status and timing
 * @throws Error if dropdown cannot be opened (FR-006)
 * @throws Error if model not found in options (FR-005)
 */
export async function switchModel(
  ctx: PuppeteerContext,
  modelName: string
): Promise<ModelSwitchResult>;
```

**File**: `src/utils/puppeteer-logic.ts`

```typescript
/**
 * Selector patterns for the model dropdown (FR-002).
 * Ordered by specificity: data-testid > aria-label > CSS classes.
 */
export const MODEL_SELECTORS = {
  // Dropdown trigger button selectors
  trigger: [
    '[data-testid="model-selector"]',
    '[aria-label*="model" i]',
    'button[class*="ModelSelector"]',
    'div[class*="model-dropdown"]',
  ],
  // Dropdown options container
  optionsContainer: [
    '[data-testid="model-options"]',
    '[role="listbox"]',
    'div[class*="dropdown-menu"]',
  ],
  // Individual option items
  option: [
    '[data-testid="model-option"]',
    '[role="option"]',
    'div[class*="model-option"]',
  ],
} as const;

/**
 * Normalize model name for case-insensitive comparison (FR-003).
 */
export function normalizeModelName(name: string): string;

/**
 * Check if a model option matches the requested model name.
 * Supports partial matching: "Claude" matches "Claude 3.5 Sonnet".
 */
export function matchesModelName(
  optionText: string,
  requestedModel: string
): boolean;
```

### 1.4 Integration Points

**chatPerplexity.ts changes**:
```typescript
export default async function chatPerplexity(
  args: { message: string; chat_id?: string; chat_url?: string; space_id?: string; model?: string },
  ctx: PuppeteerContext,
  // ... existing params
): Promise<string> {
  const { message, chat_id, chat_url, space_id, model } = args;
  
  // NEW: Switch model if specified (FR-009)
  if (model) {
    await switchModel(ctx, model);
  }
  
  // ... existing logic unchanged
}
```

**search.ts changes**:
```typescript
export default async function search(
  args: {
    query: string;
    detail_level?: "brief" | "normal" | "detailed";
    stream?: boolean;
    space_id?: string;
    model?: string; // NEW
  },
  ctx: PuppeteerContext,
  performSearch: (prompt: string, ctx: PuppeteerContext) => Promise<string>,
): Promise<string | AsyncGenerator<string, void, unknown>> {
  const { query, detail_level = "normal", stream = false, space_id, model } = args;

  // NEW: Switch model if specified (FR-009)
  if (model) {
    await switchModel(ctx, model);
  }

  // T036: Navigate to space if space_id is provided (before search)
  if (space_id) {
    await openPerplexitySpace(ctx, space_id);
  }
  // ... existing logic unchanged
}
```

---

## Phase 1 Deliverables Checklist

- [ ] `research.md` - UI selector findings from manual inspection
- [ ] `data-model.md` - `ModelSwitchResult` type definition
- [ ] `contracts/tool-schemas.patch` - Schema additions for model parameter
- [ ] `quickstart.md` - Usage examples for model switching

---

## Implementation Order (Phase 2 Preview)

| Task | File | Dependencies | Est. |
|------|------|--------------|------|
| T1: Add MODEL_SELECTORS | `puppeteer-logic.ts` | None | 0.5h |
| T2: Add normalizeModelName | `puppeteer-logic.ts` | None | 0.5h |
| T3: Add matchesModelName | `puppeteer-logic.ts` | T2 | 0.5h |
| T4: Add ModelSwitchResult type | `types/browser.ts` | None | 0.25h |
| T5: Update SearchArgs type | `types/tools.ts` | None | 0.25h |
| T6: Update ChatPerplexityArgs type | `types/tools.ts` | None | 0.25h |
| T7: Implement switchModel | `puppeteer.ts` | T1-T4 | 2h |
| T8: Update search tool | `search.ts` | T5, T7 | 0.5h |
| T9: Update chatPerplexity tool | `chatPerplexity.ts` | T6, T7 | 0.5h |
| T10: Update tool schemas | `toolSchemas.ts` | None | 0.5h |
| T11: Unit tests for logic | `model-switching.test.ts` | T1-T3 | 1h |
| T12: Unit tests for tools | `tools.test.ts` | T8, T9 | 1h |
| T13: Integration tests | `integration/model-switching.test.ts` | T7-T9 | 2h |

**Total Estimate**: ~10 hours

---

## Success Criteria Mapping

| SC | Requirement | Test | Implementation |
|----|-------------|------|----------------|
| SC-001 | Switch in <3s | Integration: measure `ModelSwitchResult.duration` | 5s timeout in `switchModel()` |
| SC-002 | 95% success rate | Integration: run 20 switches, check >19 succeed | Multiple selector fallbacks |
| SC-003 | Clear errors in <6s | Unit: verify error messages | Descriptive throws with model name |
| SC-004 | Backward compatible | Unit: call tools without `model` | `model` is optional, no-op when undefined |
| SC-005 | Case-insensitive match | Unit: test various casings | `normalizeModelName()` + `toLowerCase()` |

---

## Constitution Re-Check (Post-Design)

| Principle | Status | Notes |
|-----------|--------|-------|
| Test-First (TDD) | ✅ PASS | Tasks ordered: logic → types → tests → implementation |
| CLI Interface | ✅ PASS | No changes to I/O format |
| Library-First | ✅ PASS | `switchModel` is standalone, composable |
| Integration Testing | ✅ PASS | T13 covers browser automation flow |
| Observability | ✅ PASS | `ctx.log()` calls in switchModel |
| Simplicity | ✅ PASS | Minimal footprint, follows existing patterns |

**Final Gate**: ✅ PROCEED to Phase 2 (Tasks)

---

## Edge Cases & Error Handling

### From Spec Analysis

| Edge Case | Handling Strategy |
|-----------|------------------|
| Dropdown not visible | Throw: "Model selector not found: The page may not support model switching or you may not be logged in." |
| Multiple matching models | Select first match (deterministic by DOM order) per spec assumption |
| Network delay | 5-second timeout with clear message: "Dropdown options did not load within 5 seconds" |
| Already selected | Skip dropdown interaction, return early with success |
| Dropdown closes unexpectedly | Retry once, then throw descriptive error |

### Error Message Templates

```typescript
// FR-005: Model not found
`Model "${requestedModel}" not found in dropdown options. Available models: ${availableModels.join(', ')}`

// FR-006: Dropdown access failure
`Could not open model selector dropdown. Please ensure you are logged into Perplexity and the page has loaded.`

// Timeout
`Model selector options did not load within ${TIMEOUT}ms. Please check your connection and try again.`
```

---

## Next Steps

1. **Run `/speckit.tasks`** to generate detailed task breakdown with acceptance criteria
2. **Create feature branch**: `git checkout -b 001-model-switching`
3. **Execute T1-T4** (pure logic + types) with TDD
4. **Execute T7** (`switchModel`) with integration test harness
5. **Execute T8-T10** (tool updates + schemas)
6. **Run full test suite**: `pnpm test`
