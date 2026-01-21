# Tasks: OpenWebUI RAG Integration

**Input**: Design documents from `.specify/features/openwebui-integration/`  
**Generated**: 2026-01-20  
**Feature Branch**: `001-openwebui-rag-sync`

---

## Overview

This task list implements the OpenWebUI RAG Integration feature, which syncs the local JSONL RAG archive to an OpenWebUI knowledge base via REST API.

**Tech Stack**: Node.js/Bun, ESM, TypeScript, axios, Vitest  
**Existing Infrastructure**: RagArchiver, CONFIG pattern, logging utilities

---

## Phase 1: Setup (Project Preparation)

**Purpose**: Verify prerequisites and create feature branch

- [X] T001 Create feature branch `001-openwebui-rag-sync` from main
- [X] T002 Verify axios is available in package.json dependencies
- [X] T003 Verify `data/rag_archive.jsonl` exists or create empty placeholder

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add types and configuration that all sync operations depend on

**⚠️ CRITICAL**: No sync implementation can begin until this phase is complete

### Types Infrastructure

- [X] T004 Add `OpenWebUIConfig` interface to src/types/index.ts
- [X] T005 [P] Add `OpenWebUIFileResponse` interface to src/types/index.ts
- [X] T006 [P] Add `OpenWebUIFileStatus` interface to src/types/index.ts
- [X] T007 [P] Add `OpenWebUIKnowledgeBase` interface to src/types/index.ts
- [X] T008 [P] Add `SyncResult` interface to src/types/index.ts
- [X] T009 [P] Add `SyncState` interface to src/types/index.ts (for idempotency tracking)

### Configuration Infrastructure

- [X] T010 Add `OPENWEBUI_URL` env var to CONFIG object in src/server/config.ts (default: `http://localhost:8090`)
- [X] T011 [P] Add `OPENWEBUI_API_KEY` env var to CONFIG object in src/server/config.ts (required)
- [X] T012 [P] Add `OPENWEBUI_KB_NAME` env var to CONFIG object in src/server/config.ts (default: `Perplexity RAG Archive`)
- [X] T013 Add `OPENWEBUI_SYNC` settings object to CONFIG in src/server/config.ts (MAX_RETRIES, RETRY_DELAY_MS, PROCESSING_TIMEOUT_MS, POLL_INTERVAL_MS)

**Checkpoint**: Types and configuration are ready - sync module implementation can now begin

---

## Phase 3: User Story 1 - Sync RAG Archive to OpenWebUI (Priority: P1) 🎯 MVP

**Goal**: As a user, I can run a command to sync my local RAG archive to OpenWebUI as a knowledge base

**Independent Test**: Run `pnpm sync:openwebui` with valid API key and verify knowledge base appears in OpenWebUI

### Core Sync Module (src/utils/openwebui-sync.ts)

- [X] T014 [US1] Create OpenWebUISyncer class skeleton with constructor accepting optional config in src/utils/openwebui-sync.ts
- [X] T015 [US1] Implement `validateConfig()` method - throws if OPENWEBUI_API_KEY not set in src/utils/openwebui-sync.ts
- [X] T016 [US1] Implement axios instance creation with Bearer token header and timeout in src/utils/openwebui-sync.ts
- [X] T017 [US1] Implement `uploadFile(filePath: string)` method - POST multipart/form-data to /api/v1/files/ in src/utils/openwebui-sync.ts
- [X] T018 [US1] Implement `waitForProcessing(fileId: string)` method - poll /api/v1/files/{id}/process/status in src/utils/openwebui-sync.ts
- [X] T019 [US1] Implement `getOrCreateKnowledgeBase(name: string)` method - GET /api/v1/knowledge/ and POST /api/v1/knowledge/create in src/utils/openwebui-sync.ts
- [X] T020 [US1] Implement `addFileToKnowledgeBase(kbId: string, fileId: string)` method - POST /api/v1/knowledge/{id}/file/add in src/utils/openwebui-sync.ts
- [X] T021 [US1] Implement retry logic with exponential backoff (1s, 2s, 4s) for transient errors in src/utils/openwebui-sync.ts
- [X] T022 [US1] Implement `sync()` orchestration method - calls upload, wait, getOrCreate, addFile in sequence in src/utils/openwebui-sync.ts
- [X] T023 [US1] Add progress logging using logInfo/logWarn/logError to stderr in src/utils/openwebui-sync.ts

### CLI Entry Point

- [X] T024 [US1] Create bin/sync-openwebui.ts CLI script with main() function
- [X] T025 [US1] Add shebang `#!/usr/bin/env bun` and import OpenWebUISyncer in bin/sync-openwebui.ts
- [X] T026 [US1] Implement success/failure output formatting in bin/sync-openwebui.ts
- [X] T027 [US1] Add proper exit codes (0 success, 1 failure) in bin/sync-openwebui.ts

### npm Script Integration

- [X] T028 [US1] Add `"sync:openwebui": "bun bin/sync-openwebui.ts"` script to package.json

**Checkpoint**: User Story 1 complete - `pnpm sync:openwebui` should work end-to-end with valid config

---

## Phase 4: User Story 2 - Idempotent Sync (Priority: P2)

**Goal**: As a user, I want sync to skip if the archive hasn't changed since last sync

**Independent Test**: Run sync twice in a row without modifying archive - second run should report "Already up to date"

### Sync State Management

- [X] T029 [US2] Create `.sync-state.json` schema and path constant in src/utils/openwebui-sync.ts
- [X] T030 [US2] Implement `loadSyncState()` method - read .sync-state.json if exists in src/utils/openwebui-sync.ts
- [X] T031 [US2] Implement `saveSyncState(state: SyncState)` method - write .sync-state.json in src/utils/openwebui-sync.ts
- [X] T032 [US2] Implement `getArchiveMtime()` method - get file modification time in src/utils/openwebui-sync.ts
- [X] T033 [US2] Modify `sync()` to check mtime against last sync and skip if unchanged in src/utils/openwebui-sync.ts
- [X] T034 [US2] Update SyncResult to include `skipped: boolean` flag for "Already up to date" case in src/types/index.ts
- [X] T035 [US2] Update CLI to display "Already up to date" message when sync skipped in bin/sync-openwebui.ts

**Checkpoint**: User Story 2 complete - Repeated syncs without archive changes skip upload

---

## Phase 5: User Story 3 - Error Recovery & Diagnostics (Priority: P3)

**Goal**: As a user, I want clear error messages when sync fails so I can diagnose and fix issues

**Independent Test**: Run sync with invalid API key and verify helpful error message is displayed

### Error Handling Enhancements

- [X] T036 [US3] Add specific error class `OpenWebUISyncError` with error codes in src/utils/openwebui-sync.ts
- [X] T037 [US3] Handle 401 Unauthorized with message "Invalid API key - check OPENWEBUI_API_KEY" in src/utils/openwebui-sync.ts
- [X] T038 [US3] Handle 404 Not Found with message "OpenWebUI endpoint not found - check OPENWEBUI_URL" in src/utils/openwebui-sync.ts
- [X] T039 [US3] Handle connection refused with message "Cannot connect to OpenWebUI - ensure it's running" in src/utils/openwebui-sync.ts
- [X] T040 [US3] Handle processing timeout with message and current status in src/utils/openwebui-sync.ts
- [X] T041 [US3] Handle file not found (missing archive) with helpful message in src/utils/openwebui-sync.ts
- [X] T042 [US3] Add `--verbose` flag support to CLI for detailed logging in bin/sync-openwebui.ts

**Checkpoint**: User Story 3 complete - All error scenarios produce actionable messages

---

## Phase 6: Unit Tests (Priority: P2)

**Goal**: Comprehensive test coverage for sync module

**Note**: Tests are explicitly requested in plan.md with >80% coverage target

### Test Suite Setup

- [X] T043 [P] Create test file src/__tests__/unit/openwebui-sync.test.ts
- [X] T044 Setup axios mock factory for HTTP call mocking in test file
- [X] T045 [P] Setup fs mock for file operations in test file

### Config Validation Tests

- [X] T046 [P] Test: throws when OPENWEBUI_API_KEY is not set (T001 from plan)
- [X] T047 [P] Test: uses default URL when OPENWEBUI_URL not set (T002)
- [X] T048 [P] Test: uses default KB name when OPENWEBUI_KB_NAME not set (T003)
- [X] T049 [P] Test: accepts custom config via constructor (T004)

### File Upload Tests

- [X] T050 [P] Test: uploads file successfully and returns file ID (T005)
- [X] T051 [P] Test: throws on missing archive file (T006)
- [X] T052 [P] Test: throws on network error (T007)
- [X] T053 [P] Test: handles authentication failure 401 (T008)

### Processing Status Tests

- [X] T054 [P] Test: resolves when status becomes completed (T009)
- [X] T055 [P] Test: throws on failed status (T010)
- [X] T056 [P] Test: times out after configured duration (T011)
- [X] T057 [P] Test: retries on transient errors (T012)

### Knowledge Base Tests

- [X] T058 [P] Test: returns existing KB when name matches (T013)
- [X] T059 [P] Test: creates new KB when name not found (T014)
- [X] T060 [P] Test: handles empty KB list (T015)

### File Association Tests

- [X] T061 [P] Test: associates file with KB successfully (T016)
- [X] T062 [P] Test: handles duplicate file gracefully (T017)

### Full Sync Flow Tests

- [X] T063 Test: full sync flow succeeds with valid config (T018)
- [X] T064 [P] Test: reports "Already up to date" when unchanged (T019)
- [X] T065 [P] Test: handles empty archive file (T020)
- [X] T066 [P] Test: retries on 5xx errors (T022)
- [X] T067 [P] Test: exits with error on permanent failure (T023)

**Checkpoint**: Test suite complete with >80% coverage on new code

---

## Phase 7: Polish & Documentation

**Purpose**: Finalize feature for production use

- [X] T068 Export OpenWebUISyncer from src/utils/index.ts barrel
- [X] T069 [P] Add JSDoc comments to all public methods in src/utils/openwebui-sync.ts
- [X] T070 [P] Add environment variables documentation to README.md
- [X] T071 [P] Add sync command usage to README.md
- [X] T072 Run `pnpm test` and verify all tests pass
- [X] T073 Run `pnpm lint` and fix any issues
- [ ] T074 Run quickstart.md validation manually (set API key, run sync, verify in OpenWebUI)
- [ ] T075 Update plan.md checklist to mark "Feature branch created" complete

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)
    ↓
Phase 2 (Foundational: Types + Config)
    ↓
Phase 3 (US1: Core Sync) ──┬── Phase 4 (US2: Idempotency)
                           │
                           └── Phase 5 (US3: Error Handling)
                           │
                           └── Phase 6 (Tests)
    ↓
Phase 7 (Polish)
```

### User Story Dependencies

- **User Story 1 (P1)**: Depends on Phase 2 (Foundational) - No other story dependencies
- **User Story 2 (P2)**: Depends on US1 core sync being complete
- **User Story 3 (P3)**: Depends on US1 core sync being complete
- **Tests (Phase 6)**: Depend on US1 implementation, can run parallel with US2/US3

### Within Each User Story

- Core module methods before orchestration method
- Sync module before CLI
- CLI before npm script

### Parallel Opportunities

**Phase 2 (Types)**: T005, T006, T007, T008, T009 can all run in parallel after T004  
**Phase 2 (Config)**: T011, T012 can run in parallel with T010  
**Phase 6 (Tests)**: Almost all test tasks marked [P] can run in parallel

---

## Parallel Example: Phase 2 Types

```bash
# After T004 completes, launch these in parallel:
Task T005: "Add OpenWebUIFileResponse interface to src/types/index.ts"
Task T006: "Add OpenWebUIFileStatus interface to src/types/index.ts"
Task T007: "Add OpenWebUIKnowledgeBase interface to src/types/index.ts"
Task T008: "Add SyncResult interface to src/types/index.ts"
Task T009: "Add SyncState interface to src/types/index.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (branch creation)
2. Complete Phase 2: Foundational (types + config)
3. Complete Phase 3: User Story 1 (core sync)
4. **STOP and VALIDATE**: Run `pnpm sync:openwebui` end-to-end
5. ✅ MVP is functional

### Incremental Delivery

1. MVP → Basic sync works
2. Add US2 (Idempotency) → Efficient repeated syncs
3. Add US3 (Error Handling) → Production-ready diagnostics
4. Add Tests → Confidence for maintenance
5. Polish → Documentation and cleanup

### Estimated Time

| Phase | Effort | Est. Time |
|-------|--------|-----------|
| Phase 1: Setup | Trivial | 5 min |
| Phase 2: Foundational | Small | 25 min |
| Phase 3: User Story 1 | Large | 2-3 hours |
| Phase 4: User Story 2 | Medium | 45 min |
| Phase 5: User Story 3 | Medium | 30 min |
| Phase 6: Tests | Large | 1-2 hours |
| Phase 7: Polish | Small | 30 min |
| **Total** | | **5-7 hours** |

---

## Notes

- All HTTP calls use axios (already installed)
- All logging uses `logInfo/logError/logWarn` to stderr
- Config follows existing `CONFIG.` pattern
- Tests mock axios and fs, no real HTTP calls
- API key provided in plan.md notes for testing
- OpenWebUI URL defaults to `http://localhost:8090`

---

## Summary

| Metric | Count |
|--------|-------|
| **Total Tasks** | 75 |
| **Setup Tasks** | 3 |
| **Foundational Tasks** | 10 |
| **User Story 1 Tasks** | 15 |
| **User Story 2 Tasks** | 7 |
| **User Story 3 Tasks** | 7 |
| **Test Tasks** | 25 |
| **Polish Tasks** | 8 |
| **Parallel Tasks** | 42 (marked [P]) |

**MVP Scope**: Phases 1-3 (28 tasks) deliver functional sync command
