# Tasks: Local RAG Storage

**Input**: Design documents from `.specify/features/local-rag/`  
**Prerequisites**: plan.md ✅, spec.md ✅, data-model.md ✅, quickstart.md ✅

**Tests**: Unit tests explicitly requested in plan.md (Task 4), included below.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- File paths relative to repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Type definitions and configuration that all user stories depend on

- [X] T001 Add `RagDocument` interface to `src/types/index.ts`
- [X] T002 [P] Add `RagDocumentMetadata` interface to `src/types/index.ts`
- [X] T003 [P] Add `RAG_ARCHIVE_PATH` config to `src/server/config.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core RagArchiver module that MUST be complete before user story integration

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Create `src/server/modules/` directory if not exists
- [X] T005 Create RagArchiver class constructor in `src/server/modules/RagArchiver.ts`
- [X] T006 Implement `ensureDirectory()` method in `src/server/modules/RagArchiver.ts`
- [X] T007 Implement `log()` method for single RagDocument in `src/server/modules/RagArchiver.ts`
- [X] T008 Implement `logInteraction()` method for user+assistant pair in `src/server/modules/RagArchiver.ts`
- [X] T009 Add error handling with `logError()` for all I/O operations in `src/server/modules/RagArchiver.ts`
- [X] T010 Export RagArchiver from `src/server/modules/RagArchiver.ts`

**Checkpoint**: RagArchiver module ready for integration ✅

---

## Phase 3: User Story 1 - Archive Perplexity Interactions Automatically (Priority: P1) 🎯 MVP

**Goal**: All Perplexity interactions automatically archived to JSONL file with valid RagDocument schema

**Independent Test**: Make a single `chat_perplexity` call and verify 2 valid JSONL entries (user + assistant) appear in `./data/rag_archive.jsonl`

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T011 [P] [US1] Test: RagArchiver constructor creates instance with default path in `src/__tests__/unit/rag-archiver.test.ts`
- [X] T012 [P] [US1] Test: RagArchiver constructor accepts custom path in `src/__tests__/unit/rag-archiver.test.ts`
- [X] T013 [P] [US1] Test: ensureDirectory creates nested directories in `src/__tests__/unit/rag-archiver.test.ts`
- [X] T014 [P] [US1] Test: ensureDirectory is no-op when directory exists in `src/__tests__/unit/rag-archiver.test.ts`
- [X] T015 [P] [US1] Test: log appends valid JSONL line to file in `src/__tests__/unit/rag-archiver.test.ts`
- [X] T016 [P] [US1] Test: log generates unique UUID per entry in `src/__tests__/unit/rag-archiver.test.ts`
- [X] T017 [P] [US1] Test: log includes ISO 8601 timestamp in `src/__tests__/unit/rag-archiver.test.ts`
- [X] T018 [P] [US1] Test: logInteraction creates 2 entries (user + assistant) in `src/__tests__/unit/rag-archiver.test.ts`
- [X] T019 [P] [US1] Test: logInteraction includes citations in assistant metadata in `src/__tests__/unit/rag-archiver.test.ts`

### Implementation for User Story 1

- [X] T020 [US1] Update `chatPerplexity()` signature to accept optional `ragArchiver` parameter in `src/tools/chatPerplexity.ts`
- [X] T021 [US1] Add RagArchiver integration call after `performSearch()` returns in `src/tools/chatPerplexity.ts`
- [X] T022 [US1] Ensure archive call is fire-and-forget with `.catch(() => {})` in `src/tools/chatPerplexity.ts`
- [X] T023 [US1] Instantiate RagArchiver at server startup in `src/server/toolHandlerSetup.ts`
- [X] T024 [US1] Call `ragArchiver.ensureDirectory()` during server init in `src/server/toolHandlerSetup.ts`
- [X] T025 [US1] Inject RagArchiver instance into chatPerplexity handler in `src/server/toolHandlerSetup.ts`

**Checkpoint**: User Story 1 complete - every successful search produces 2 JSONL entries ✅

---

## Phase 4: User Story 2 - Configure Archive Location (Priority: P2)

**Goal**: Archive file location configurable via `RAG_ARCHIVE_PATH` environment variable

**Independent Test**: Set `RAG_ARCHIVE_PATH=/tmp/test-archive.jsonl`, make a search, verify archive writes to that location

### Tests for User Story 2

- [X] T026 [P] [US2] Test: RagArchiver uses RAG_ARCHIVE_PATH env var when set in `src/__tests__/unit/rag-archiver.test.ts`
- [X] T027 [P] [US2] Test: RagArchiver defaults to `./data/rag_archive.jsonl` when env not set in `src/__tests__/unit/rag-archiver.test.ts`
- [X] T028 [P] [US2] Test: ensureDirectory creates parent directories for custom path in `src/__tests__/unit/rag-archiver.test.ts`

### Implementation for User Story 2

- [X] T029 [US2] Verify CONFIG.RAG_ARCHIVE_PATH correctly reads from process.env in `src/server/config.ts`
- [X] T030 [US2] Add startup log message showing configured archive path in `src/server/toolHandlerSetup.ts`

**Checkpoint**: User Story 2 complete - archive location fully configurable ✅

---

## Phase 5: User Story 3 - Reliable Archive Writes Under Load (Priority: P3)

**Goal**: Atomic, reliable archive writes that never corrupt data or crash server under concurrent load

**Independent Test**: Run 10+ concurrent searches, verify all entries are valid JSON lines with no interleaving

### Tests for User Story 3

- [X] T031 [P] [US3] Test: Error handler logs error on permission failure in `src/__tests__/unit/rag-archiver.test.ts`
- [X] T032 [P] [US3] Test: Error handler does not throw on write failure in `src/__tests__/unit/rag-archiver.test.ts`
- [X] T033 [P] [US3] Test: Concurrent writes produce valid JSONL (multiple rapid calls) in `src/__tests__/unit/rag-archiver.test.ts`

### Implementation for User Story 3

- [X] T034 [US3] Verify `fs/promises.appendFile()` is used for POSIX atomic semantics in `src/server/modules/RagArchiver.ts`
- [X] T035 [US3] Add startup validation for archive path writability in `src/server/modules/RagArchiver.ts`
- [X] T036 [US3] Log warning if archive path is unwritable (but don't crash) in `src/server/modules/RagArchiver.ts`

**Checkpoint**: User Story 3 complete - archive writes are atomic and failure-tolerant ✅

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validation, documentation, and final quality checks

- [X] T037 [P] Add JSDoc comments to all RagArchiver public methods in `src/server/modules/RagArchiver.ts`
- [X] T038 [P] Update README.md with RAG_ARCHIVE_PATH configuration documentation
- [X] T039 Run `vitest` to ensure >80% coverage for RagArchiver.ts
- [ ] T040 E2E validation: Start server, execute `chat_perplexity`, verify 2 entries in archive
- [ ] T041 E2E validation: Parse archive with `jq -c '.' ./data/rag_archive.jsonl`
- [ ] T042 E2E validation: Set RAG_ARCHIVE_PATH=/tmp/custom.jsonl and verify custom path works

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup) ─────────────────────────────────────────────────────────────┐
├── T001: RagDocument interface                                              │
├── T002: [P] RagDocumentMetadata interface                                  │
└── T003: [P] RAG_ARCHIVE_PATH config                                        │
                                                                             ↓
Phase 2 (Foundational) ──────────────────────────────────────────────────────┤
├── T004: Create modules directory                                           │
├── T005-T010: RagArchiver implementation                                    │
│   T005 → T006 → T007 → T008 → T009 → T010 (sequential)                     │
                                                                             ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│  User Stories can now proceed in parallel (P1 recommended first for MVP)    │
└─────────────────────────────────────────────────────────────────────────────┘

Phase 3 (US1: Auto-Archive)    Phase 4 (US2: Config)    Phase 5 (US3: Reliability)
├── T011-T019: Tests [P]       ├── T026-T028: Tests [P]  ├── T031-T033: Tests [P]
├── T020-T025: Integration     ├── T029-T030: Config     ├── T034-T036: Hardening
                                                                             ↓
Phase 6 (Polish) ─────────────────────────────────────────────────────────────
├── T037-T038: Documentation [P]
├── T039: Coverage verification
└── T040-T042: E2E validation
```

### User Story Dependencies

- **User Story 1 (P1)**: Depends on Phase 2 completion. No dependencies on other stories. **MVP SCOPE**
- **User Story 2 (P2)**: Depends on Phase 2 completion. Can run in parallel with US1.
- **User Story 3 (P3)**: Depends on Phase 2 completion. Can run in parallel with US1/US2.

### Parallel Opportunities

**Within Phase 1** (all can run in parallel):
```bash
T001 & T002 & T003  # Different files, no dependencies
```

**Within Phase 3 Tests** (all can run in parallel):
```bash
T011 & T012 & T013 & T014 & T015 & T016 & T017 & T018 & T019
```

**Within Phase 4 Tests** (all can run in parallel):
```bash
T026 & T027 & T028
```

**Within Phase 5 Tests** (all can run in parallel):
```bash
T031 & T032 & T033
```

**Across User Stories** (if team capacity allows):
```bash
# After Phase 2 completes, all three can start:
Phase 3 (US1) || Phase 4 (US2) || Phase 5 (US3)
```

---

## Implementation Strategy

### MVP Scope (User Story 1 Only)

For minimum viable delivery, complete:
- **Phase 1**: T001-T003 (Setup)
- **Phase 2**: T004-T010 (Foundational)
- **Phase 3**: T011-T025 (User Story 1)
- **Phase 6**: T039-T041 (Basic validation)

**Estimated Time**: ~2.5 hours

### Full Feature Scope

Complete all phases in order for full feature delivery.

**Estimated Time**: ~3.5 hours

---

## Summary

| Metric | Value |
|--------|-------|
| **Total Tasks** | 42 |
| **Setup Tasks** | 3 |
| **Foundational Tasks** | 7 |
| **User Story 1 (P1)** | 15 tasks (9 tests + 6 implementation) |
| **User Story 2 (P2)** | 5 tasks (3 tests + 2 implementation) |
| **User Story 3 (P3)** | 6 tasks (3 tests + 3 implementation) |
| **Polish Tasks** | 6 |
| **Parallel Opportunities** | 24 tasks marked [P] |
| **MVP Scope** | Phases 1-3 + basic validation (28 tasks) |

---

**Generated**: 2026-01-20  
**Source**: plan.md, spec.md, data-model.md  
**Next Step**: Execute tasks sequentially starting with T001
