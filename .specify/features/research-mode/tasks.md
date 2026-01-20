# Tasks: Research Mode Toggle

**Feature**: Research Mode Toggle  
**Generated**: January 20, 2026  
**Source**: [plan.md](./plan.md) | [spec.md](../../specs/001-research-mode-toggle/spec.md)

## Overview

This task list implements the Research Mode Toggle feature, which allows switching between "search" (fast answers) and "deep-research" (comprehensive analysis) modes in the Perplexity web UI.

**Total Tasks**: 17  
**Estimated Effort**: 4-6 hours

---

## Phase 1: Setup

Foundation tasks that enable all subsequent development.

- [X] T001 Add `ResearchMode` type to `src/types/index.ts`
- [X] T002 [P] Export `ResearchMode` from types barrel file if needed

---

## Phase 2: Foundational (Blocking Prerequisites)

Core infrastructure that User Stories depend on.

- [X] T003 Add `RESEARCH_MODE_SELECTORS` constant to `src/utils/puppeteer-logic.ts`
- [X] T004 [P] Add `isResearchModeActive()` pure function to `src/utils/puppeteer-logic.ts`
- [X] T005 Export new functions from `src/utils/puppeteer-logic.ts` if not auto-exported

---

## Phase 3: User Story 1 - Quick Search Query (P1)

**Goal**: Ensure search mode is the default and quick search queries work efficiently.

**Independent Test Criteria**: Send a query without specifying research mode, verify "search" mode is used by default and results return quickly.

### Implementation Tasks

- [X] T006 [US1] Add `setResearchMode()` function skeleton to `src/utils/puppeteer.ts`
- [X] T007 [US1] Implement current mode detection via `aria-selected` check in `setResearchMode()` at `src/utils/puppeteer.ts`
- [X] T008 [US1] Implement early-return optimization when mode already active in `setResearchMode()` at `src/utils/puppeteer.ts`
- [X] T009 [US1] Add `research_mode` property to search tool schema in `src/schema/toolSchemas.ts`
- [X] T010 [US1] Add `research_mode` parameter handling to `src/tools/search.ts` (default to 'search')

### Unit Tests

- [X] T011 [P] [US1] Create test file `src/__tests__/unit/research-mode.test.ts` with `RESEARCH_MODE_SELECTORS` structure tests
- [X] T012 [P] [US1] Add `isResearchModeActive()` pure function tests to `src/__tests__/unit/research-mode.test.ts`

---

## Phase 4: User Story 2 - Deep Research Analysis (P1)

**Goal**: Enable comprehensive analysis mode for thorough research queries.

**Independent Test Criteria**: Send a query with `research_mode: 'deep-research'`, verify mode toggle is clicked and comprehensive results are returned.

### Implementation Tasks

- [X] T013 [US2] Implement fallback selector logic for finding toggle elements in `setResearchMode()` at `src/utils/puppeteer.ts`
- [X] T014 [US2] Implement mode button click and 500ms UI stabilization delay in `setResearchMode()` at `src/utils/puppeteer.ts`
- [X] T015 [US2] Implement graceful degradation (warn and proceed) when toggle not found in `setResearchMode()` at `src/utils/puppeteer.ts`

### Unit Tests

- [X] T016 [P] [US2] Add `setResearchMode()` mock-based tests for deep-research toggle to `src/__tests__/unit/research-mode.test.ts`

---

## Phase 5: User Story 3 - Mode Switching Between Queries (P2)

**Goal**: Seamlessly switch between modes across different queries.

**Independent Test Criteria**: Send alternating queries with different mode settings, verify each query uses the correct mode without redundant clicks.

### Integration Verification

- [X] T017 [US3] Verify mode switch efficiency: no redundant clicks when consecutive queries use the same mode in `src/__tests__/unit/research-mode.test.ts`

---

## Dependencies

```text
T001 ─────────────────────────────────┐
                                      │
T003 ──► T004 ──► T006 ──► T007 ──► T008 ──► T010
              │                        │
              └──────────► T011 ◄──────┘
                              │
T009 ─────────────► T010 ◄────┘
                      │
                      ▼
T013 ──► T014 ──► T015 ──► T016
                            │
                            ▼
                          T017
```

**Critical Path**: T001 → T003 → T004 → T006 → T007 → T008 → T010 → T013 → T014 → T015

---

## Parallel Execution Opportunities

| Phase | Parallelizable Tasks | Notes |
|-------|---------------------|-------|
| Phase 1 | T001 ∥ T002 | Type definitions independent |
| Phase 2 | T003 ∥ T004 (after T003) | Selectors and pure function |
| Phase 3 | T009 ∥ T006-T008 | Schema update independent of implementation |
| Phase 3 | T011 ∥ T012 | Test files can be written in parallel |
| Phase 4 | T016 independent after T014 | Tests can lag behind implementation |

---

## Implementation Strategy

### MVP Scope (Recommended First Pass)

Complete User Story 1 + User Story 2 core path:
- T001 → T003 → T004 → T006 → T007 → T008 → T009 → T010 → T013 → T014 → T015

This delivers both Search and Deep Research modes as functional features.

### Incremental Delivery

1. **Iteration 1**: Setup + Foundational (T001-T005) - Selectors and types ready
2. **Iteration 2**: US1 Implementation (T006-T010) - Default search mode works
3. **Iteration 3**: US1 Tests (T011-T012) - Search mode validated
4. **Iteration 4**: US2 Implementation (T013-T015) - Deep research works
5. **Iteration 5**: US2 + US3 Tests (T016-T017) - Full coverage

---

## Acceptance Criteria Mapping

| Requirement | Tasks | Verification |
|------------|-------|--------------|
| FR-001: Two research modes | T001, T003 | Type and selectors defined |
| FR-002: Default to 'search' | T010 | `research_mode` defaults in search.ts |
| FR-003: Check current state | T007, T008 | `aria-selected` check, early return |
| FR-004: Fallback selectors | T003, T013 | `RESEARCH_MODE_SELECTORS` has multiple options |
| FR-005: UI stabilization | T014 | 500ms delay after toggle |
| FR-006: Optional parameter | T009 | Schema accepts 'search' ∣ 'deep-research' |
| FR-007: Graceful degradation | T015 | Warn and proceed if element not found |
| SC-003: No redundant clicks | T008, T017 | Early return when mode unchanged |

---

## Verification Checklist

After all tasks complete:

- [ ] `pnpm check` passes (lint, test, build, typecheck)
- [ ] Unit tests in `research-mode.test.ts` all pass
- [ ] Coverage thresholds met (80% lines/functions, 75% branches)
- [ ] Manual smoke test: query with `research_mode: 'search'`
- [ ] Manual smoke test: query with `research_mode: 'deep-research'`
- [ ] Manual smoke test: query without `research_mode` (should default to search)
