# Tasks: Code Review Fixes

**Feature Branch**: `feature/perplexity-enhancements-2026`  
**Spec Reference**: [spec.md](./spec.md)  
**Plan Reference**: [plan.md](./plan.md)  
**Created**: 2026-01-20

---

## Summary

| Metric | Count |
|--------|-------|
| **Total Tasks** | 21 |
| **User Story 1 (Type Safety)** | 4 tasks |
| **User Story 2 (Streaming)** | 3 tasks |
| **User Story 3 (Chat Identity)** | 8 tasks |
| **User Story 4 (Version Sync)** | 2 tasks |
| **Verification Phase** | 4 tasks |

**MVP Scope**: User Story 1 + User Story 2 (P1 tasks - type safety and streaming fixes)

---

## Phase 1: Setup (No Blocking Setup Required)

**Purpose**: This feature modifies existing files - no project initialization needed.

**Note**: All changes are to existing production code. No new project structure required.

---

## Phase 2: Foundational (No Blocking Prerequisites)

**Purpose**: The interface `IBrowserManager` already declares `getPuppeteerContext()` at line 144 of `src/types/browser.ts` - verified in plan.md research. No foundational changes required.

**Checkpoint**: Proceed directly to user story implementation.

---

## Phase 3: User Story 1 - Type-Safe Server Operations (Priority: P1) 🎯 MVP

**Goal**: Remove all `as any` casts from flagged files and ensure TypeScript validates all interface calls at compile time.

**Independent Test**: Run `pnpm build` with strict TypeScript - zero type errors, zero `as any` in `PerplexityServer.ts` line 171 and `login.ts` line 35.

### Implementation for User Story 1

- [X] T001 [P] [US1] Remove `as any` cast from `createPuppeteerContext()` in src/server/PerplexityServer.ts (line 171)
- [X] T002 [P] [US1] Remove `(window as any).chrome` cast in src/login.ts (line 35)
- [X] T003 [US1] Verify `src/types/browser.ts` is included in tsconfig compilation for global Chrome types
- [X] T004 [US1] Run `pnpm build` to verify zero type errors

**Checkpoint**: User Story 1 complete - `pnpm build` succeeds with no `as any` in flagged files.

---

## Phase 4: User Story 2 - MCP-Compatible Streaming Results (Priority: P1) 🎯 MVP

**Goal**: Implement AsyncGenerator detection and accumulation so streaming search results return complete text responses instead of generator objects.

**Independent Test**: Call search tool with `stream: true` and verify complete accumulated text response is returned (not `[object AsyncGenerator]`).

### Implementation for User Story 2

- [X] T005 [US2] Implement AsyncGenerator detection using `Symbol.asyncIterator` check in src/server/toolHandlerSetup.ts (lines 44-58)
- [X] T006 [US2] Implement chunk accumulation logic to collect all generator yields into single string in src/server/toolHandlerSetup.ts
- [X] T007 [US2] Add unit test for AsyncGenerator detection and accumulation in src/server/__tests__/toolHandlerSetup.test.ts

**Checkpoint**: User Story 2 complete - streaming requests return accumulated text.

---

## Phase 5: User Story 3 - URL-Based Chat Identity (Priority: P2)

**Goal**: Refactor SearchEngine to return structured results including Perplexity URL, replacing UUID-based chat_ids with actual page URLs.

**Independent Test**: Initiate new chat, verify returned `chat_id` is a valid Perplexity URL (not UUID), open URL in browser to see conversation.

### Implementation for User Story 3

- [X] T008 [P] [US3] Define `SearchResult` interface with `{ answer, url, citations }` in src/types/tools.ts
- [X] T009 [P] [US3] Export `SearchResult` from src/types/index.ts
- [X] T010 [US3] Update `ISearchEngine` interface to return `Promise<SearchResult>` in src/types/tools.ts
- [X] T011 [US3] Update `SearchEngine.performSearch()` to capture page URL and return `SearchResult` in src/server/modules/SearchEngine.ts
- [X] T012 [US3] Update `handleChatPerplexity()` to use URL as chat_id in src/server/PerplexityServer.ts (lines 90-118)
- [X] T013 [P] [US3] Update `handleGetDocumentation()` to destructure `SearchResult` in src/server/PerplexityServer.ts (lines 120-126)
- [X] T014 [P] [US3] Update `handleFindApis()` to destructure `SearchResult` in src/server/PerplexityServer.ts (lines 128-134)
- [X] T015 [P] [US3] Update `handleCheckDeprecatedCode()` and `handleSearch()` to destructure `SearchResult` in src/server/PerplexityServer.ts (lines 136-155)

**Checkpoint**: User Story 3 complete - chat_id is Perplexity URL, not UUID.

---

## Phase 6: User Story 4 - Consistent Version Reporting (Priority: P3)

**Goal**: Sync server version with package.json so MCP initialization response reports correct version.

**Independent Test**: Check `package.json` version (0.3.1), make MCP initialize request, verify `serverInfo.version` matches.

### Implementation for User Story 4

- [X] T016 [US4] Import package.json version using `createRequire()` pattern in src/server/PerplexityServer.ts (top of file)
- [X] T017 [US4] Replace hardcoded "0.2.0" with `pkg.version` in Server constructor in src/server/PerplexityServer.ts (line 33)

**Checkpoint**: User Story 4 complete - server version matches package.json.

---

## Phase 7: Verification & Polish

**Purpose**: Validate all changes work together and meet acceptance criteria.

- [X] T018 Run `pnpm build` - verify zero type errors
- [X] T019 Run `pnpm lint` - verify no new linting errors (81 pre-existing errors unrelated to this feature)
- [X] T020 Run `pnpm test:run` - verify all existing tests pass
- [ ] T021 Manual verification: start server, test streaming search, verify chat_id is URL

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup): SKIP - No setup required
      │
      ▼
Phase 2 (Foundational): SKIP - Interface already correct
      │
      ▼
┌─────┴─────┐
▼           ▼
Phase 3     Phase 4        ← Can run in PARALLEL (US1 + US2 are independent)
(US1)       (US2)
      │
      ▼
Phase 5 (US3)              ← Depends on Phase 3+4 completion (SearchResult refactor)
      │
      ▼
Phase 6 (US4)              ← Can run anytime, no dependencies
      │
      ▼
Phase 7 (Verify)           ← Must run after all implementation phases
```

### User Story Dependencies

| Story | Depends On | Notes |
|-------|------------|-------|
| **US1** (P1) | None | Type-only changes, isolated |
| **US2** (P1) | None | Streaming logic isolated to toolHandlerSetup.ts |
| **US3** (P2) | US1, US2 | SearchResult refactor touches same files |
| **US4** (P3) | None | Version sync is independent |

### Within User Story 3 (Sequential Order Required)

1. T008, T009 (Types) - Can be parallel
2. T010 (Interface) - Depends on T008
3. T011 (SearchEngine) - Depends on T010
4. T012-T015 (Callers) - Depends on T011

### Parallel Opportunities

| Parallel Group | Tasks | Notes |
|----------------|-------|-------|
| **Type Safety** | T001, T002 | Different files, no dependencies |
| **SearchResult Types** | T008, T009 | Different files |
| **PerplexityServer Callers** | T013, T014, T015 | Same file but independent methods |

---

## Parallel Execution Example: MVP Phase

```bash
# Terminal 1: User Story 1 (Type Safety)
T001 → T002 → T003 → T004

# Terminal 2: User Story 2 (Streaming) - runs in parallel
T005 → T006 → T007

# Both complete → Run verification
T018 → T019 → T020
```

---

## Implementation Strategy

### MVP First (Recommended)

1. **Implement US1 + US2** (Phase 3 + Phase 4) - Core fixes, no breaking changes
2. **Run verification** (T018-T020) - Ensure no regressions
3. **Commit checkpoint** - "Type safety and streaming fixes (US1, US2)"
4. **Implement US3** (Phase 5) - Breaking interface change
5. **Run verification** - Full test suite
6. **Commit** - "SearchResult refactor with URL-based chat_id (US3)"
7. **Implement US4** (Phase 6) - Version sync
8. **Final verification** (T021) - Manual E2E test
9. **Commit** - "Version sync and final polish (US4)"

### Incremental Delivery

Each user story is independently deliverable:

- **After US1+US2**: Code compiles cleanly, streaming works ✅
- **After US3**: Chat resumption uses real URLs ✅
- **After US4**: Version reporting is accurate ✅

---

## Acceptance Criteria Checklist

From spec.md Success Criteria:

- [X] **SC-001**: Zero `as any` in `PerplexityServer.ts` line 171
- [X] **SC-001**: Zero `as any` in `login.ts` line 35
- [X] **SC-002**: `pnpm build` succeeds with no type errors
- [X] **SC-003**: Streaming search returns accumulated text
- [X] **SC-004**: New chat sessions return Perplexity URL as chat_id
- [X] **SC-005**: Server version matches package.json (0.3.1)
- [X] **SC-006**: All existing tests pass
- [ ] **SC-007**: Chat resumption works with URL-based chat_ids (manual verification)

---

## Files Modified Summary

| File | Tasks | User Story |
|------|-------|------------|
| `src/server/PerplexityServer.ts` | T001, T012-T017 | US1, US3, US4 |
| `src/login.ts` | T002 | US1 |
| `src/server/toolHandlerSetup.ts` | T005, T006 | US2 |
| `src/server/__tests__/toolHandlerSetup.test.ts` | T007 | US2 |
| `src/types/tools.ts` | T008, T010 | US3 |
| `src/types/index.ts` | T009 | US3 |
| `src/server/modules/SearchEngine.ts` | T011 | US3 |

---

**Estimated Effort**: 2-3 hours  
**Next Step**: Begin Phase 3 (User Story 1) and Phase 4 (User Story 2) in parallel
