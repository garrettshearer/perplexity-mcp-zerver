# Perplexica RAG Sync Implementation Plan

## Phase 1: Foundation (Core Module)

### 1.1 Type Definitions
- Add `PerplexicaSyncConfig` interface to `src/types/index.ts`
- Add `PerplexicaSyncState` interface
- Add `PerplexicaSyncResult` interface
- Add `PerplexicaUploadResponse` interface

### 1.2 Configuration
- Add Perplexica config to `src/server/config.ts`:
  - `PERPLEXICA_URL` (env: `PERPLEXICA_URL`, default: `http://localhost:3001`)
  - `PERPLEXICA_SYNC_STATE_PATH` (default: `data/perplexica_sync.json`)
  - `PERPLEXICA_EMBEDDING_MODEL` (default: `nomic-embed-text`)
  - `PERPLEXICA_EMBEDDING_PROVIDER` (default: `ollama`)

### 1.3 PerplexicaSyncer Class
Create `src/utils/perplexica-sync.ts`:
- Constructor with config injection
- `loadSyncState()` - Read JSON sync state file
- `saveSyncState()` - Persist sync state
- `convertToTextFile()` - Transform RagDocument to uploadable text + filename
- `isAlreadySynced()` - Check if document ID in sync state
- `sync()` - Main orchestration method

## Phase 2: HTTP Upload Implementation

### 2.1 Upload Logic
- Create FormData with file content
- Include embedding model and provider params
- POST to `/api/uploads`
- Parse response for success/failure

### 2.2 Batch Handling
- Group documents into batches (configurable size)
- Upload each batch sequentially
- Track progress and failures

### 2.3 Error Handling
- Detect Perplexica unavailability (connection refused)
- Handle HTTP errors (400, 500)
- Retry logic for transient failures

## Phase 3: CLI Interface

### 3.1 bin/sync-perplexica.ts
- Parse CLI args (--verbose, --dry-run, --perplexica-url, --embedding-model, --embedding-provider)
- Instantiate PerplexicaSyncer with config
- Run sync and report results
- Exit codes for CI integration

### 3.2 Package.json Script
- Add `"sync:perplexica": "tsx bin/sync-perplexica.ts"`

## Phase 4: Testing

### 4.1 Unit Tests
- `src/utils/__tests__/perplexica-sync.test.ts`
- Mock fetch for upload tests
- Test sync state persistence
- Test document conversion
- Test deduplication logic
- Test batch handling

### 4.2 Integration Tests (Manual)
- Run against live Perplexica instance
- Verify documents appear in Perplexica library
- Test re-sync idempotency

## Implementation Order

1. Types and Config (20 min)
2. PerplexicaSyncer core class structure (30 min)
3. Sync state management (load/save) (20 min)
4. Document conversion (15 min)
5. HTTP upload implementation (45 min)
6. CLI tool (20 min)
7. Unit tests (45 min)
8. Manual verification (15 min)

**Estimated Total: 3.5 hours** (simplified from Puppeteer approach)
