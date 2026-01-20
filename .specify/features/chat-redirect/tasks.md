# Tasks: Redirect to Existing Chat by URL

**Input**: Design documents from `/specs/001-chat-redirect/`
**Prerequisites**: plan.md ✅, spec.md ✅

**Tests**: Unit tests are included as specified in plan.md (Vitest)

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- All paths relative to repository root

---

## Phase 1: Setup

**Purpose**: No setup needed - feature extends existing infrastructure

- [X] T001 Verify existing project structure matches plan expectations (src/utils/, src/tools/, src/types/)
- [X] T002 [P] Verify Vitest test infrastructure is working with `pnpm test`

**Checkpoint**: Existing infrastructure confirmed ready

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core utilities that multiple user stories depend on

**⚠️ CRITICAL**: User Story 1 and 3 both depend on `extractChatId()` - must complete first

### Implementation

- [X] T003 Create `extractChatId()` function in src/utils/extraction.ts
  - Add PERPLEXITY_URL_PATTERNS regex array for `/search/` and `/chat/` patterns
  - Add CHAT_ID_PATTERN regex for raw ID validation
  - Handle: full URL, partial URL (no protocol), raw chat ID passthrough
  - Return `string | null`

- [X] T004 [P] Update `ChatPerplexityArgs` interface in src/types/tools.ts
  - Add optional `chat_url?: string` property
  - Add optional `chat_id?: string` property (may already exist)

**Checkpoint**: Foundation utilities ready - user story implementation can begin

---

## Phase 3: User Story 2 - Extract Chat ID from Various URL Formats (Priority: P1)

**Goal**: Parse and extract chat IDs from any valid Perplexity URL format

**Independent Test**: Pass various URL patterns → verify correct chat ID extracted

### Tests for User Story 2

- [X] T005 [P] [US2] Add unit tests for `extractChatId()` in src/__tests__/unit/extraction.test.ts
  - Test: Full search URL with protocol → extracts ID
  - Test: Chat URL format → extracts ID
  - Test: URL without protocol → extracts ID
  - Test: Raw chat ID passthrough → returns same ID
  - Test: Invalid URL → returns null
  - Test: Empty input → returns null
  - Test: URL with www prefix → extracts ID
  - Test: URL without www prefix → extracts ID

### Verification

- [X] T006 [US2] Run `pnpm test` to verify all extraction tests pass

**Checkpoint**: User Story 2 complete - all URL formats correctly parsed

---

## Phase 4: User Story 1 - Continue Existing Chat Session (Priority: P1)

**Goal**: Navigate to existing Perplexity chat via URL with history pre-loaded

**Independent Test**: Provide valid chat URL → browser navigates → textarea ready for input

**Depends on**: T003 (extractChatId)

### Tests for User Story 1

- [X] T007 [P] [US1] Create unit tests for `openPerplexityChat()` in src/__tests__/unit/chat-redirect.test.ts
  - Test: Navigates to correct URL with 30s timeout
  - Test: 404 response → throws "Chat not found" error
  - Test: Redirect away from Perplexity → throws auth error
  - Test: Textarea not found → throws timeout error
  - Test: Page not initialized → throws error
  - Mock: page.goto, page.url, page.waitForSelector, HTTPResponse

### Implementation for User Story 1

- [X] T008 [US1] Create `openPerplexityChat()` function in src/utils/puppeteer.ts
  - Accept PuppeteerContext and chatId parameters
  - Construct URL: `https://www.perplexity.ai/search/${chatId}`
  - Navigate with `page.goto()` and `waitUntil: "domcontentloaded"`
  - Apply 30 second navigation timeout (FR-009)
  - Check HTTP response status (404 = chat not found)
  - Verify URL stays on perplexity.ai (detect auth redirects)
  - Wait for textarea selector with 10 second timeout (FR-010)
  - Use `getSearchInputSelectors()` from puppeteer-logic.ts
  - Throw descriptive errors for all failure modes

- [X] T009 [US1] Export `openPerplexityChat` from src/utils/puppeteer.ts index/barrel

### Verification

- [X] T010 [US1] Run `pnpm test` to verify all chat-redirect tests pass

**Checkpoint**: User Story 1 complete - can navigate to existing chats by URL

---

## Phase 5: User Story 3 - Use Chat ID Directly (Priority: P2)

**Goal**: Accept raw chat ID and construct URL automatically

**Independent Test**: Provide chat ID string → tool constructs URL → navigates to chat

**Depends on**: T003 (extractChatId), T008 (openPerplexityChat)

### Implementation for User Story 3

- [X] T011 [US3] Update `chatPerplexity` tool in src/tools/chatPerplexity.ts
  - Import `extractChatId` from utils/extraction.ts
  - Import `openPerplexityChat` from utils/puppeteer.ts
  - Add `chat_url` and `chat_id` to args destructuring
  - Implement precedence logic: chat_url > chat_id (FR-007)
  - Call `extractChatId()` to validate and normalize input
  - Throw clear error for invalid URL/ID format (FR-008)
  - Call `openPerplexityChat()` when resuming existing chat
  - Skip history replay for existing chats (history pre-loaded by URL)
  - Generate new UUID for fresh conversations

- [X] T012 [US3] Update tool schema in src/schema/toolSchemas.ts
  - Add `chat_url` property to chat_perplexity inputSchema
    - type: "string"
    - description: "Optional: Full Perplexity chat URL to continue"
  - Add `chat_id` property to chat_perplexity inputSchema (if not present)
    - type: "string"
    - description: "Optional: Chat session ID to continue"
  - Update tool description to mention chat continuation

### Verification

- [X] T013 [US3] Run `pnpm lint` to verify no linting errors (pre-existing lint issues unrelated to feature)
- [X] T014 [US3] Run `pnpm build` to verify TypeScript compilation

**Checkpoint**: User Story 3 complete - raw chat IDs accepted and processed

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and quality checks

- [X] T015 [P] Run full test suite with `pnpm test`
- [X] T016 [P] Run linting with `pnpm lint` (pre-existing lint issues unrelated to feature)
- [X] T017 [P] Run build with `pnpm build`
- [ ] T018 Manual test: Valid chat URL → opens existing chat
- [ ] T019 Manual test: Raw chat ID → constructs URL and navigates
- [ ] T020 Manual test: Invalid URL → returns clear error message
- [ ] T021 Manual test: Expired/deleted chat (404) → returns error message
- [ ] T022 Verify SC-001: Chat opens within 5 seconds (excluding network)
- [ ] T023 Verify SC-005: No messages re-typed when opening existing chat

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup) → Phase 2 (Foundational) → Phase 3-5 (User Stories) → Phase 6 (Polish)
```

### Task Dependencies

```
T001, T002 (Setup - parallel)
    ↓
T003 (extractChatId) ─────┬────────────────────┐
T004 (types) ──────────── │ ─────────────────── │ ── (parallel)
    ↓                     ↓                     ↓
T005 (US2 tests)      T007 (US1 tests)      T011 (US3 tool update)
T006 (verify)         T008 (openPerplexityChat)   T012 (schema)
                      T009 (export)           T013, T014 (verify)
                      T010 (verify)
                          ↓
                    T015-T023 (Polish)
```

### User Story Dependencies

- **User Story 2 (P1)**: Depends on T003 only - can test extraction in isolation
- **User Story 1 (P1)**: Depends on T003 - implements navigation with extracted IDs
- **User Story 3 (P2)**: Depends on T003, T008 - integrates both into tool

### Parallel Opportunities

```bash
# Phase 1: All setup tasks in parallel
T001, T002

# Phase 2: Both foundational tasks in parallel
T003, T004

# After Phase 2: Tests for US1 and US2 in parallel
T005, T007

# Phase 5 verification tasks in parallel
T013, T014

# Phase 6 polish checks in parallel
T015, T016, T017
```

---

## Implementation Strategy

### MVP First (User Stories 1 & 2)

1. Complete Phase 1: Setup verification
2. Complete Phase 2: Foundational (T003, T004)
3. Complete Phase 3: User Story 2 (URL extraction with tests)
4. Complete Phase 4: User Story 1 (navigation with tests)
5. **STOP and VALIDATE**: Both core stories independently testable
6. Can ship MVP with URL-based chat continuation

### Full Feature

1. Complete MVP above
2. Complete Phase 5: User Story 3 (raw chat ID convenience)
3. Complete Phase 6: Polish and manual verification
4. Full feature ready for deployment

### Estimated Time

| Phase | Tasks | Est. Time |
|-------|-------|-----------|
| Phase 1 | T001-T002 | 5 min |
| Phase 2 | T003-T004 | 20 min |
| Phase 3 | T005-T006 | 15 min |
| Phase 4 | T007-T010 | 35 min |
| Phase 5 | T011-T014 | 25 min |
| Phase 6 | T015-T023 | 20 min |
| **Total** | | **~2 hours** |

---

## Notes

- All tests use Vitest (existing infrastructure)
- `extractChatId()` is foundational - implement first
- Existing `navigateToPerplexity()` pattern in puppeteer.ts is the model for `openPerplexityChat()`
- Textarea selector from existing `getSearchInputSelectors()` function
- FR-007: chat_url takes precedence over chat_id when both provided
- SC-005: No message replay - existing chats have history pre-loaded by URL
