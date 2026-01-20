# Tasks: Space Redirect

**Input**: Design documents from `.specify/features/space-redirect/`  
**Prerequisites**: plan.md ✅, spec.md ✅  
**Generated**: 2026-01-20

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)

---

## Phase 1: Setup

**Purpose**: Branch creation and verification

- [X] T001 Create feature branch: `git checkout -b 001-space-redirect`
- [X] T002 Verify baseline tests pass: `pnpm test`
- [X] T003 Verify build succeeds: `pnpm build`

---

## Phase 2: Foundational (Types & Schemas)

**Purpose**: Add types and schemas that all user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 [P] Add `space_id?: string` property to `ChatPerplexityArgs` interface in src/types/tools.ts
- [X] T005 [P] Add `space_id?: string` property to `SearchArgs` interface in src/types/tools.ts
- [X] T006 [P] Add `space_id` property to `chat_perplexity` tool schema in src/schema/toolSchemas.ts
- [X] T007 [P] Add `space_id` property to `search` tool schema in src/schema/toolSchemas.ts
- [X] T008 Verify TypeScript compiles: `pnpm build`

**Checkpoint**: Types and schemas ready - core function implementation can begin

---

## Phase 3: User Story 1 - Navigate to a Specific Perplexity Space (Priority: P1) 🎯 MVP

**Goal**: Implement core `openPerplexitySpace()` function that navigates browser to a Perplexity Space URL

**Independent Test**: Provide a valid space ID and verify browser navigates to correct URL, waits for chat input selector

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T009 [US1] Create test file src/__tests__/unit/space-redirect.test.ts with test suite structure (copy from chat-redirect.test.ts pattern)
- [X] T010 [P] [US1] Write failing test: "throws on null page" in src/__tests__/unit/space-redirect.test.ts
- [X] T011 [P] [US1] Write failing test: "throws on closed page" in src/__tests__/unit/space-redirect.test.ts
- [X] T012 [P] [US1] Write failing test: "throws on empty space ID" in src/__tests__/unit/space-redirect.test.ts
- [X] T013 [P] [US1] Write failing test: "throws on whitespace-only space ID" in src/__tests__/unit/space-redirect.test.ts
- [X] T014 [P] [US1] Write failing test: "navigates to correct space URL format" in src/__tests__/unit/space-redirect.test.ts
- [X] T015 [P] [US1] Write failing test: "uses 30s navigation timeout" in src/__tests__/unit/space-redirect.test.ts
- [X] T016 [P] [US1] Write failing test: "throws Space not found on 404" in src/__tests__/unit/space-redirect.test.ts
- [X] T017 [P] [US1] Write failing test: "throws Authentication required on auth redirect" in src/__tests__/unit/space-redirect.test.ts
- [X] T018 [P] [US1] Write failing test: "throws on selector timeout" in src/__tests__/unit/space-redirect.test.ts
- [X] T019 [P] [US1] Write failing test: "logs navigation attempt" in src/__tests__/unit/space-redirect.test.ts
- [X] T020 [US1] Run tests and verify ALL fail: `pnpm test src/__tests__/unit/space-redirect.test.ts`

### Implementation for User Story 1

- [X] T021 [US1] Add `openPerplexitySpace` function signature and export in src/utils/puppeteer.ts
- [X] T022 [US1] Implement page null/closed validation in `openPerplexitySpace` (make T010, T011 pass)
- [X] T023 [US1] Implement space ID empty/whitespace validation (make T012, T013 pass)
- [X] T024 [US1] Implement URL construction and navigation to `https://www.perplexity.ai/spaces/{spaceId}` (make T014, T015 pass)
- [X] T025 [US1] Implement 404 error detection and "Space not found" error (make T016 pass)
- [X] T026 [US1] Implement auth redirect detection and "Authentication required" error (make T017 pass)
- [X] T027 [US1] Implement selector wait with timeout and appropriate error (make T018 pass)
- [X] T028 [US1] Implement logging for navigation attempt (make T019 pass)
- [X] T029 [US1] Run full test suite and verify ALL pass: `pnpm test src/__tests__/unit/space-redirect.test.ts`

**Checkpoint**: User Story 1 complete - `openPerplexitySpace()` function fully tested and working

---

## Phase 4: User Story 2 - Search Within a Perplexity Space (Priority: P2)

**Goal**: Update search tool to accept optional `space_id` and navigate to space before searching

**Independent Test**: Provide space ID with search query and verify space navigation occurs before search execution

### Tests for User Story 2 ⚠️

- [X] T030 [P] [US2] Write failing test: "search with space_id calls openPerplexitySpace before performSearch" in src/__tests__/unit/tools.test.ts
- [X] T031 [P] [US2] Write failing test: "search without space_id does NOT call openPerplexitySpace" in src/__tests__/unit/tools.test.ts
- [X] T032 [P] [US2] Write failing test: "search space navigation error propagates (search not attempted)" in src/__tests__/unit/tools.test.ts
- [X] T033 [US2] Run tests and verify ALL fail: `pnpm test src/__tests__/unit/tools.test.ts --grep "search.*space"`

### Implementation for User Story 2

- [X] T034 [US2] Import `openPerplexitySpace` in src/tools/search.ts
- [X] T035 [US2] Add `space_id` parameter destructuring in search function args in src/tools/search.ts
- [X] T036 [US2] Add space navigation logic before performSearch call in src/tools/search.ts
- [X] T037 [US2] Run tests and verify ALL pass: `pnpm test src/__tests__/unit/tools.test.ts --grep "search.*space"`

**Checkpoint**: User Story 2 complete - search tool supports space_id parameter

---

## Phase 5: User Story 3 - Chat Within a Perplexity Space (Priority: P2)

**Goal**: Update chatPerplexity tool to accept optional `space_id` and navigate to space for new chats

**Independent Test**: Provide space ID with chat message (no chat_id/chat_url) and verify space navigation occurs

### Tests for User Story 3 ⚠️

- [X] T038 [P] [US3] Write failing test: "new chat with space_id calls openPerplexitySpace" in src/__tests__/unit/tools.test.ts
- [X] T039 [P] [US3] Write failing test: "existing chat with chat_id ignores space_id" in src/__tests__/unit/tools.test.ts
- [X] T040 [P] [US3] Write failing test: "existing chat with chat_url ignores space_id" in src/__tests__/unit/tools.test.ts
- [X] T041 [P] [US3] Write failing test: "chat without space_id works as before" in src/__tests__/unit/tools.test.ts
- [X] T042 [US3] Run tests and verify ALL fail: `pnpm test src/__tests__/unit/tools.test.ts --grep "chat.*space"`

### Implementation for User Story 3

- [X] T043 [US3] Import `openPerplexitySpace` in src/tools/chatPerplexity.ts
- [X] T044 [US3] Add `space_id` parameter destructuring from args in src/tools/chatPerplexity.ts
- [X] T045 [US3] Add space navigation logic (only for new chats, respecting precedence) in src/tools/chatPerplexity.ts
- [X] T046 [US3] Run tests and verify ALL pass: `pnpm test src/__tests__/unit/tools.test.ts --grep "chat.*space"`

**Checkpoint**: User Story 3 complete - chatPerplexity tool supports space_id parameter

---

## Phase 6: User Story 4 - Handle Invalid or Inaccessible Spaces (Priority: P3)

**Goal**: Ensure clear error messages for all space navigation failure scenarios

**Independent Test**: Provide invalid space ID and verify meaningful error messages

### Tests for User Story 4 ⚠️

- [X] T047 [P] [US4] Write test: "404 error message includes space ID and suggestion" in src/__tests__/unit/space-redirect.test.ts
- [X] T048 [P] [US4] Write test: "auth error message suggests checking login status" in src/__tests__/unit/space-redirect.test.ts
- [X] T049 [P] [US4] Write test: "timeout error message includes retry suggestion" in src/__tests__/unit/space-redirect.test.ts
- [X] T050 [US4] Run tests: `pnpm test src/__tests__/unit/space-redirect.test.ts --grep "error message"`

### Implementation for User Story 4

- [X] T051 [US4] Enhance 404 error message with space ID and helpful suggestion in src/utils/puppeteer.ts
- [X] T052 [US4] Enhance auth error message with login check suggestion in src/utils/puppeteer.ts
- [X] T053 [US4] Enhance timeout error message with retry suggestion in src/utils/puppeteer.ts
- [X] T054 [US4] Run tests and verify ALL pass: `pnpm test src/__tests__/unit/space-redirect.test.ts`

**Checkpoint**: User Story 4 complete - all error messages are clear and actionable

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup

- [X] T055 Run full test suite: `pnpm test`
- [ ] T056 Run linter: `pnpm lint` (86 pre-existing errors, not caused by space-redirect feature)
- [X] T057 Run build: `pnpm build`
- [ ] T058 Manual E2E test: search with valid space_id
- [ ] T059 Manual E2E test: chat with valid space_id
- [ ] T060 Manual E2E test: invalid space_id returns clear error
- [ ] T061 Manual E2E test: backwards compatibility - search without space_id
- [ ] T062 Manual E2E test: backwards compatibility - chat without space_id
- [ ] T063 [P] Update spec.md with any discovered edge cases
- [ ] T064 Create PR with spec reference

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational - core function required by US2, US3
- **User Story 2 (Phase 4)**: Depends on User Story 1 (needs `openPerplexitySpace`)
- **User Story 3 (Phase 5)**: Depends on User Story 1 (needs `openPerplexitySpace`) - CAN run parallel with US2
- **User Story 4 (Phase 6)**: Depends on User Story 1 (enhances error messages)
- **Polish (Phase 7)**: Depends on all user stories complete

### Parallel Opportunities

**Within Phase 2 (Foundational)**:
```bash
# All type/schema tasks can run in parallel:
T004: "Add space_id to ChatPerplexityArgs in src/types/tools.ts"
T005: "Add space_id to SearchArgs in src/types/tools.ts"
T006: "Add space_id to chat_perplexity schema in src/schema/toolSchemas.ts"
T007: "Add space_id to search schema in src/schema/toolSchemas.ts"
```

**Within Phase 3 (US1 Tests)**:
```bash
# All failing test tasks can run in parallel:
T010-T019: All individual test case tasks
```

**Across Phases 4 & 5**:
```bash
# User Stories 2 and 3 can run in parallel (different files):
Phase 4: US2 - src/tools/search.ts
Phase 5: US3 - src/tools/chatPerplexity.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (types & schemas)
3. Complete Phase 3: User Story 1 (`openPerplexitySpace` function)
4. **STOP and VALIDATE**: Run `pnpm test` - all tests should pass
5. Deploy/demo core navigation capability

### Incremental Delivery

1. Complete Setup + Foundational → Types ready
2. Add User Story 1 → Core navigation working → Test independently (MVP!)
3. Add User Story 2 → Search with space support → Test independently
4. Add User Story 3 → Chat with space support → Test independently
5. Add User Story 4 → Enhanced error handling → Test independently
6. Each story adds value without breaking previous stories

---

## Summary

| Metric | Count |
|--------|-------|
| **Total Tasks** | 64 |
| **Setup Tasks** | 3 |
| **Foundational Tasks** | 5 |
| **User Story 1 Tasks** | 21 |
| **User Story 2 Tasks** | 8 |
| **User Story 3 Tasks** | 9 |
| **User Story 4 Tasks** | 8 |
| **Polish Tasks** | 10 |
| **Parallelizable Tasks** | 24 |

**Suggested MVP Scope**: Phases 1-3 (User Story 1) - 29 tasks to working navigation function

---

## Notes

- All tests use TDD approach: write failing test → implement → verify pass
- Precedence for `chatPerplexity`: `chat_url` > `chat_id` > `space_id`
- Space navigation only occurs for NEW chats (not existing conversations)
- Selector reuse: same textarea selectors as main Perplexity interface
- Timeout values: 30s navigation, 10s selector (matches existing patterns)
