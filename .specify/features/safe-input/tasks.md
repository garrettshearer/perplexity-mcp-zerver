# Tasks: Safe Input for Multiline Prompts

**Input**: Design documents from `/specs/001-safe-multiline-input/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: Unit tests are included as this feature requires validation of DOM manipulation, event dispatch, and selector fallbacks per FR-001 through FR-010.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1=Multiline, US2=Special Chars, US3=React Events, US4=Robust Selectors)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add type definitions and selector constants required by all user stories

- [X] T001 [P] Add `SendChatMessageOptions` interface to `src/types/browser.ts` with fields: textareaTimeout, submitTimeout, autoSubmit, eventTypes, verifyValue (per data-model.md)
- [X] T002 [P] Add `SendChatMessageResult` interface to `src/types/browser.ts` with fields: success, setValue, textareaSelector, submitSelector, error, durationMs (per data-model.md)
- [X] T003 Export new types from `src/types/index.ts` barrel file
- [X] T004 [P] Add `SUBMIT_BUTTON_SELECTORS` constant array to `src/utils/puppeteer-logic.ts` (15 selectors in priority order per data-model.md)
- [X] T005 [P] Add `TEXTAREA_SELECTORS` constant array to `src/utils/puppeteer-logic.ts` for chat input detection
- [X] T006 Add `getSubmitButtonSelector()` pure function to `src/utils/puppeteer-logic.ts` that returns combined selector string

**Checkpoint**: All types and selectors are defined and exported ✅

---

## Phase 2: Foundational (Core Function Skeleton)

**Purpose**: Create the main `sendChatMessage()` function structure that all user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T007 Add `sendChatMessage()` function signature to `src/utils/puppeteer.ts` matching contract in `contracts/sendChatMessage.ts`
- [X] T008 Implement textarea detection logic in `sendChatMessage()`: wait for selector using `page.waitForSelector()` with timeout from options
- [X] T009 Implement focus logic: call `page.focus()` on textarea before value manipulation
- [X] T010 Implement result object construction with timing measurement using `performance.now()`
- [X] T011 Export `sendChatMessage` from `src/utils/puppeteer.ts`

**Checkpoint**: Function skeleton ready - user story implementation can begin ✅

---

## Phase 3: User Story 1 - Submit Multiline Prompts (Priority: P1) 🎯 MVP

**Goal**: Multiline prompts with `\n` characters are preserved exactly when submitted

**Independent Test**: Send `"Line1\nLine2\nLine3"` and verify the textarea contains three lines

### Tests for User Story 1

- [X] T012 [P] [US1] Create test file `src/__tests__/unit/safe-input.test.ts` with describe block for multiline tests
- [X] T013 [P] [US1] Add test: "preserves single newline character" - input `"Hello\nWorld"`, verify setValue contains `\n`
- [X] T014 [P] [US1] Add test: "preserves multiple consecutive newlines" - input `"A\n\n\nB"`, verify 3 newlines preserved
- [X] T015 [P] [US1] Add test: "preserves code block formatting" - input with triple backticks and newlines

### Implementation for User Story 1

- [X] T016 [US1] Implement native value setter pattern in `sendChatMessage()`: use `Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set` per research.md R2
- [X] T017 [US1] Implement `page.$eval()` call that sets value using native setter (bypasses React controlled component)
- [X] T018 [US1] Add value verification logic: read back textarea value, compare with input (when `verifyValue: true`)

**Checkpoint**: `sendChatMessage(ctx, "Line1\nLine2")` correctly preserves newlines in textarea ✅

---

## Phase 4: User Story 2 - Handle Special Characters (Priority: P1)

**Goal**: Special characters (quotes, brackets, Unicode, emojis) are preserved without escaping or corruption

**Independent Test**: Send `"Test 'single' \"double\" \`backtick\` <tag> {obj} 日本語🎉"` and verify exact preservation

### Tests for User Story 2

- [X] T019 [P] [US2] Add test: "preserves single and double quotes" - input `"It's \"quoted\""`, verify exact match
- [X] T020 [P] [US2] Add test: "preserves angle brackets and braces" - input `"<div>{data}</div>"`, verify exact match
- [X] T021 [P] [US2] Add test: "preserves Unicode characters" - input `"日本語 한국어 العربية"`, verify exact match
- [X] T022 [P] [US2] Add test: "preserves emoji characters" - input `"Hello 🎉🚀💻"`, verify exact match
- [X] T023 [P] [US2] Add test: "preserves mixed special characters" - input with all types combined

### Implementation for User Story 2

- [X] T024 [US2] Verify `page.$eval()` implementation passes message as-is without string escaping (string passed directly to browser context)
- [X] T025 [US2] Add error message with character context if value verification fails: show expected vs actual with char codes

**Checkpoint**: All special character types are transmitted without corruption ✅

---

## Phase 5: User Story 3 - Trigger React Change Detection (Priority: P1)

**Goal**: React's synthetic event system detects the value change and enables the submit button

**Independent Test**: Set textarea value, dispatch events, verify submit button becomes enabled

### Tests for User Story 3

- [X] T026 [P] [US3] Add test: "dispatches input event with bubbles:true" - mock page.$eval, verify event config
- [X] T027 [P] [US3] Add test: "uses fallback events if primary fails" - mock initial failure, verify eventTypes array used
- [X] T028 [P] [US3] Add test: "updates React state correctly" - integration test with mock React form

### Implementation for User Story 3

- [X] T029 [US3] Implement event dispatch in `page.$eval()`: `textarea.dispatchEvent(new Event('input', { bubbles: true, composed: true }))` per research.md R1
- [X] T030 [US3] Add fallback event dispatch logic: iterate through `options.eventTypes` array if primary fails
- [X] T031 [US3] Add brief delay after event dispatch to allow React state update (50ms)

**Checkpoint**: Submit button enables within 5 seconds of setting textarea value (SC-003) ✅

---

## Phase 6: User Story 4 - Robust Submit Button Detection (Priority: P2)

**Goal**: Submit button is found using fallback selectors even if Perplexity UI changes

**Independent Test**: Mock DOM with only data-testid selector, verify button is found and clicked

### Tests for User Story 4

- [X] T032 [P] [US4] Add test file `src/__tests__/unit/puppeteer-logic.test.ts` for selector tests
- [X] T033 [P] [US4] Add test: "tries aria-label selectors first" - verify selector order
- [X] T034 [P] [US4] Add test: "falls back to data-testid selectors" - mock aria-label missing
- [X] T035 [P] [US4] Add test: "falls back to button[type=submit]" - mock testid missing
- [X] T036 [P] [US4] Add test: "throws descriptive error if all selectors fail" - verify error contains selector list

### Implementation for User Story 4

- [X] T037 [US4] Implement submit button detection in `sendChatMessage()`: iterate through `SUBMIT_BUTTON_SELECTORS` array
- [X] T038 [US4] Add `page.waitForSelector()` with combined selector string and `submitTimeout`
- [X] T039 [US4] Implement visibility and enabled check: `page.$eval()` to verify button is not disabled
- [X] T040 [US4] Add click retry logic with 500ms delay on first failure
- [X] T041 [US4] Add descriptive error on failure: include which selectors were tried and current URL

**Checkpoint**: Submit succeeds with any of the 15 fallback selectors ✅

---

## Phase 7: Integration (Replace Legacy Code)

**Goal**: Replace `page.type()` with `sendChatMessage()` in all message input paths

- [X] T042 Modify `executeSearch()` in `src/server/modules/SearchEngine.ts`: replace `page.type(selector, query, { delay })` (line 122) with `sendChatMessage(ctx, query)`
- [X] T043 Remove `page.keyboard.press("Enter")` call from `executeSearch()` (auto-submit handles this)
- [X] T044 Update error handling in `executeSearch()` to catch `sendChatMessage` errors
- [X] T045 Search codebase for any other `page.type()` or `keyboard.type()` calls on textarea elements and replace

**Checkpoint**: `grep -r "page.type" src/` returns zero matches for message input paths (SC-004) ✅

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, validation, and final quality checks

- [X] T046 Add JSDoc comments to `sendChatMessage()` with examples per contracts/sendChatMessage.ts
- [X] T047 Add inline comments explaining native setter pattern (reference research.md R2)
- [X] T048 Run full test suite: `pnpm test` - all tests must pass
- [X] T049 Run coverage check: `pnpm test:coverage` - verify 80%+ coverage on new code
- [X] T050 Verify SC-004: run `grep -rn "page.type\|keyboard.type" src/server/modules/` returns no textarea matches
- [ ] T051 Manual E2E test: send multiline prompt via MCP, verify exact text in Perplexity UI
- [ ] T052 Update `specs/001-safe-multiline-input/plan.md` to mark Phase 2 complete

---

## Dependencies

```
Phase 1 (T001-T006)
    │
    ▼
Phase 2 (T007-T011) ─── Foundational skeleton
    │
    ├───────┬───────┬───────┐
    ▼       ▼       ▼       ▼
Phase 3  Phase 4  Phase 5  Phase 6   (User Stories - can parallelize some tasks)
(US1)    (US2)    (US3)    (US4)
    │       │       │       │
    └───────┴───────┴───────┘
                │
                ▼
         Phase 7 (T042-T045) ─── Integration
                │
                ▼
         Phase 8 (T046-T052) ─── Polish
```

## Parallel Execution Opportunities

**Within Phase 1**: T001, T002, T004, T005 can all run in parallel (different files)

**Within User Story Phases**: All test tasks (marked [P]) can run in parallel with each other

**Cross-Story Parallelism**: Once Phase 2 is complete:
- US1 tests (T012-T015) can run parallel with US2 tests (T019-T023)
- US3 and US4 tests can also run in parallel
- Implementation tasks within each story are sequential

## Implementation Strategy

1. **MVP Scope**: Complete Phase 1-3 (User Story 1) for working multiline support
2. **Extended MVP**: Add Phase 4-5 (User Stories 2-3) for production-quality input
3. **Full Feature**: Add Phase 6 (User Story 4) for maximum resilience
4. **Ship**: Complete Phase 7-8 for integration and polish

**Estimated Total Tasks**: 52
**Parallelizable Tasks**: 21 (40%)
**MVP Tasks (US1 only)**: 18 tasks
