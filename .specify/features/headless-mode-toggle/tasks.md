# Tasks: Headless Mode Toggle

**Input**: Design documents from `.specify/features/headless-mode-toggle/`  
**Plan**: [plan.md](./plan.md)  
**Spec**: [spec.md](../../../specs/001-headless-mode-toggle/spec.md)  
**Created**: 2026-01-20  
**Estimated Time**: 2-3 hours

---

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)

## User Story Mapping

| Story | Priority | Title | Goal |
|-------|----------|-------|------|
| US1 | P1 | Debug Browser Automation Issues | Enable visible browser for debugging |
| US2 | P2 | Demonstrate MCP Server Capabilities | Enable visible browser for demos |
| US3 | P1 | Reduce Cloudflare Detection Blocks | Integrate puppeteer-extra with stealth plugin |
| US4 | P1 | Prevent Race Conditions During Initialization | Implement promise-based lock |

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add dependencies required by all user stories

- [X] T001 Add `puppeteer-extra` dependency (^3.3.6) in package.json
- [X] T002 [P] Add `puppeteer-extra-plugin-stealth` dependency (^2.11.2) in package.json
- [X] T003 Run `pnpm install` and verify no peer dependency warnings

**Checkpoint**: Dependencies installed, ready for implementation

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core configuration and type changes that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Add `HEADLESS` property to CONFIG in src/server/config.ts
  - Value: `process.env["PERPLEXITY_HEADLESS"] !== "false" ? "new" : false`
  - Type: `"new" | false`
- [X] T005 [P] Add `initPromise` field to PuppeteerContext interface in src/types/browser.ts
  - Add: `initPromise: Promise<void> | null;`
- [X] T006 [P] Add `setInitPromise` method to PuppeteerContext interface in src/types/browser.ts
  - Add: `setInitPromise: (promise: Promise<void> | null) => void;`
- [X] T007 Verify TypeScript compiles with `pnpm build`

**Checkpoint**: Foundation ready - all type definitions and config in place

---

## Phase 3: User Story 1 & 2 - Visible Browser Mode (Priority: P1/P2) 🎯 MVP

**Goal**: Enable toggling between headless and visible browser modes via `PERPLEXITY_HEADLESS` env var

**Independent Test**: Set `PERPLEXITY_HEADLESS=false`, start server, invoke any search tool, verify visible browser window appears

### Implementation for User Stories 1 & 2

- [X] T008 [US1/US2] Update import in src/utils/puppeteer.ts to use puppeteer-extra
  - Change: `import puppeteer, { type Browser, type Page } from "puppeteer";`
  - To: `import puppeteer from "puppeteer-extra";` and `import type { Browser, Page } from "puppeteer";`
- [X] T009 [US1/US2] Update `initializeBrowser()` in src/utils/puppeteer.ts to use CONFIG.HEADLESS
  - Replace hardcoded `headless: true` with `headless: CONFIG.HEADLESS`
  - Import CONFIG from `../server/config.js`
- [X] T010 [US1/US2] Add GPU argument filtering in src/utils/puppeteer.ts for visible mode
  - When `CONFIG.HEADLESS === false`, filter out `--disable-gpu` and `--disable-accelerated-2d-canvas` from browser args
- [X] T011 [US1/US2] Verify extraction.ts in src/utils/extraction.ts inherits new headless behavior (no changes needed)

**Checkpoint**: User Stories 1 & 2 complete - visible browser mode works via env var

---

## Phase 4: User Story 3 - Stealth Plugin Integration (Priority: P1)

**Goal**: Integrate puppeteer-extra stealth plugin to reduce Cloudflare bot detection

**Independent Test**: Run searches and verify improved success rate against Cloudflare challenges

### Implementation for User Story 3

- [X] T012 [US3] Import StealthPlugin in src/utils/puppeteer.ts
  - Add: `import StealthPlugin from "puppeteer-extra-plugin-stealth";`
- [X] T013 [US3] Apply stealth plugin at module level in src/utils/puppeteer.ts
  - Add after imports: `puppeteer.use(StealthPlugin());`
- [X] T014 [US3] Verify stealth plugin does not conflict with existing `setupBrowserEvasion()` function

**Checkpoint**: User Story 3 complete - stealth plugin active for bot detection evasion

---

## Phase 5: User Story 4 - Promise-Based Initialization Lock (Priority: P1)

**Goal**: Implement thread-safe browser initialization that handles concurrent requests

**Independent Test**: Invoke two tools simultaneously, verify only one browser instance created

### Implementation for User Story 4

- [X] T015 [US4] Add `initPromise` private property to BrowserManager class in src/server/modules/BrowserManager.ts
  - Add: `private initPromise: Promise<void> | null = null;`
- [X] T016 [US4] Update `getPuppeteerContext()` in src/server/modules/BrowserManager.ts to return initPromise and setInitPromise
  - Add `initPromise` to returned context object
  - Add `setInitPromise: (promise) => { this.initPromise = promise; }` to returned context
- [X] T017 [US4] Refactor `initialize()` method in src/server/modules/BrowserManager.ts for promise-based locking
  - If `this.initPromise` exists, await it and return early
  - Create new `this.initPromise = this._doInitialize()` for actual work
  - Wrap in try/finally to ensure `this.initPromise = null` on completion or failure
- [X] T018 [US4] Extract initialization logic to private `_doInitialize()` method in src/server/modules/BrowserManager.ts
  - Move actual `initializeBrowser()` call to this method
- [X] T019 [US4] Verify lock is released on initialization failure (allows retry)

**Checkpoint**: User Story 4 complete - concurrent initialization handled safely

---

## Phase 6: Testing

**Purpose**: Validate all user stories work correctly

### Unit Tests

- [X] T020 [P] Create unit test for CONFIG.HEADLESS in src/__tests__/unit/config.test.ts
  - Test: defaults to `"new"` when env var not set
  - Test: returns `false` when env var is `"false"`
  - Test: returns `"new"` for any other value (`"true"`, `"1"`, `"yes"`)
- [X] T021 [P] Add concurrent initialization test to src/__tests__/unit/browser-manager.test.ts
  - Test: two simultaneous `initialize()` calls result in only one actual initialization
  - Test: lock is released on failure, allowing retry

### Integration Tests

- [ ] T022 Create integration test file src/__tests__/integration/headless-mode.test.ts
  - Test: visible browser launches when `PERPLEXITY_HEADLESS=false` (skip in CI)
  - Test: headless browser launches by default
- [X] T023 Run all tests with `pnpm test` and verify no regressions

**Checkpoint**: All tests pass

---

## Phase 7: Documentation & Polish

**Purpose**: Document changes and ensure production readiness

- [X] T024 [P] Update README.md with `PERPLEXITY_HEADLESS` environment variable documentation
  - Add to Configuration/Environment Variables table
  - Add "Debugging with Visible Browser" section with example command
- [X] T025 [P] Add inline documentation comments to CONFIG.HEADLESS in src/server/config.ts
- [X] T026 Run full validation: `pnpm build && pnpm test && pnpm lint`
- [ ] T027 Manual verification: Test `PERPLEXITY_HEADLESS=false bun run start` shows visible browser
- [ ] T028 Manual verification: Test default startup runs in headless mode

**Checkpoint**: Feature complete, documented, and validated

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1: Setup ─────────────────────────┐
                                        ├─► Phase 2: Foundational
Phase 1 must complete first ────────────┘
                                               │
                                               ▼
                        ┌──────────────────────┴──────────────────────┐
                        │                                              │
                        ▼                                              ▼
              Phase 3: US1/US2                              Phase 5: US4
              (Visible Mode)                                (Init Lock)
                        │                                              │
                        ▼                                              │
              Phase 4: US3                                             │
              (Stealth Plugin)                                         │
                        │                                              │
                        └──────────────────────┬───────────────────────┘
                                               │
                                               ▼
                                    Phase 6: Testing
                                               │
                                               ▼
                                    Phase 7: Documentation
```

### Task-Level Dependencies

| Task | Depends On | Reason |
|------|------------|--------|
| T003 | T001, T002 | Must add deps before install |
| T007 | T004, T005, T006 | Type check after type changes |
| T008-T010 | T004, T007 | Needs CONFIG.HEADLESS defined |
| T012-T014 | T008 | Needs puppeteer-extra import |
| T015-T019 | T005, T006, T007 | Needs initPromise types |
| T020-T023 | All implementation | Tests verify implementation |
| T024-T028 | T023 | Document after tests pass |

### Parallel Opportunities

**Within Phase 1**:
```bash
# These can run in parallel (different package.json entries):
T001: Add puppeteer-extra dependency
T002: Add puppeteer-extra-plugin-stealth dependency
```

**Within Phase 2**:
```bash
# These can run in parallel (different files):
T005: Add initPromise to PuppeteerContext (browser.ts)
T006: Add setInitPromise to PuppeteerContext (browser.ts)
```

**Between Phase 3 and Phase 5**:
```bash
# These phases can run in parallel (different concerns):
Phase 3: US1/US2 - Visible browser mode (puppeteer.ts)
Phase 5: US4 - Init lock (BrowserManager.ts)
```

**Within Phase 6**:
```bash
# Test files can be created in parallel:
T020: Unit test for config (config.test.ts)
T021: Unit test for browser manager (browser-manager.test.ts)
```

---

## Implementation Strategy

### MVP First (User Stories 1-3)

1. Complete Phase 1: Setup (5 min)
2. Complete Phase 2: Foundational (10 min)
3. Complete Phase 3: US1/US2 - Visible Mode (15 min)
4. Complete Phase 4: US3 - Stealth Plugin (10 min)
5. **STOP and VALIDATE**: Test visible browser works
6. Proceed to Phase 5-7 for complete feature

### Incremental Delivery

| Increment | Stories | Value Delivered |
|-----------|---------|-----------------|
| 1 | Setup + Foundation | Build passes with new types |
| 2 | US1 + US2 | Visible browser mode for debugging/demos |
| 3 | US3 | Improved Cloudflare evasion |
| 4 | US4 | Thread-safe initialization |
| 5 | Tests + Docs | Production-ready feature |

---

## Success Verification Checklist

From plan.md:

- [ ] `pnpm install` - Dependencies install without errors
- [ ] `pnpm build` - TypeScript compiles without errors
- [ ] `pnpm test` - All existing tests pass
- [ ] `pnpm test` - New unit tests pass
- [ ] Manual test: `PERPLEXITY_HEADLESS=false bun run start` shows browser
- [ ] Manual test: Default startup runs in headless mode
- [ ] Manual test: Concurrent tool calls don't create multiple browsers
- [ ] README documents new environment variable

---

## Notes

- **[P] tasks** = different files, no dependencies, can run in parallel
- **[Story] label** maps task to specific user story for traceability
- US1 and US2 combined (same implementation, different use cases)
- All P1 stories (US1, US3, US4) are critical for feature completeness
- Stealth plugin supplements existing `setupBrowserEvasion()`, doesn't replace it
- Visible mode requires display server (will fail on headless CI)
