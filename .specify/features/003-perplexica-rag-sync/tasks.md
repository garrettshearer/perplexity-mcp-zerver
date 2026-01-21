# Perplexica RAG Sync Tasks

## Overview
Implement HTTP-based sync from local JSONL archive to Perplexica's `/api/uploads` endpoint.

---

## Task 1: Add Type Definitions
**Status:** Not Started  
**Priority:** P0  
**Estimate:** 15 min

### Description
Add TypeScript interfaces for Perplexica sync configuration and state.

### Acceptance Criteria
- [ ] `PerplexicaSyncConfig` interface added to `src/types/index.ts`
- [ ] `PerplexicaSyncState` interface added
- [ ] `PerplexicaSyncResult` interface added
- [ ] `PerplexicaUploadResponse` interface added
- [ ] All types exported from barrel

### Implementation
```typescript
// src/types/index.ts
export interface PerplexicaSyncConfig {
  perplexicaUrl: string;
  archivePath: string;
  syncStatePath: string;
  embeddingModel: string;
  embeddingProvider: string;
  batchSize: number;
}

export interface PerplexicaSyncState {
  lastSyncTime: string;
  syncedDocumentIds: string[];
  totalSynced: number;
}

export interface PerplexicaSyncResult {
  success: boolean;
  newDocumentsSynced: number;
  skippedDocuments: number;
  errors: string[];
}

export interface PerplexicaUploadResponse {
  files: Array<{
    id: string;
    name: string;
    status: string;
  }>;
}
```

---

## Task 2: Add Configuration
**Status:** Not Started  
**Priority:** P0  
**Estimate:** 10 min  
**Depends On:** Task 1

### Description
Add Perplexica configuration to server config.

### Acceptance Criteria
- [ ] `PERPLEXICA_URL` config added (default: http://localhost:3001)
- [ ] `PERPLEXICA_SYNC_STATE_PATH` config added (default: data/perplexica_sync.json)
- [ ] `PERPLEXICA_EMBEDDING_MODEL` config added (default: nomic-embed-text)
- [ ] `PERPLEXICA_EMBEDDING_PROVIDER` config added (default: ollama)
- [ ] `PERPLEXICA_BATCH_SIZE` config added (default: 5)

### Implementation
```typescript
// src/server/config.ts
export const PERPLEXICA_URL = process.env.PERPLEXICA_URL || 'http://localhost:3001';
export const PERPLEXICA_SYNC_STATE_PATH = process.env.PERPLEXICA_SYNC_STATE_PATH || 'data/perplexica_sync.json';
export const PERPLEXICA_EMBEDDING_MODEL = process.env.PERPLEXICA_EMBEDDING_MODEL || 'nomic-embed-text';
export const PERPLEXICA_EMBEDDING_PROVIDER = process.env.PERPLEXICA_EMBEDDING_PROVIDER || 'ollama';
export const PERPLEXICA_BATCH_SIZE = parseInt(process.env.PERPLEXICA_BATCH_SIZE || '5', 10);
```

---

## Task 3: Implement PerplexicaSyncer Class
**Status:** Not Started  
**Priority:** P0  
**Estimate:** 45 min  
**Depends On:** Task 1, Task 2

### Description
Create the main PerplexicaSyncer class with core sync logic.

### Acceptance Criteria
- [ ] Class created in `src/utils/perplexica-sync.ts`
- [ ] Constructor accepts partial config with defaults
- [ ] `loadSyncState()` reads JSON from disk
- [ ] `saveSyncState()` writes JSON to disk
- [ ] `convertToTextFile()` transforms RagDocument to {content, filename}
- [ ] `isAlreadySynced()` checks sync state
- [ ] `uploadDocuments()` POSTs to /api/uploads
- [ ] `sync()` orchestrates full sync workflow
- [ ] Exported from `src/utils/index.ts`

### Implementation Notes
- Use built-in fetch() (Node.js 24)
- Create FormData with Blob for file upload
- Handle streaming JSONL parsing with readline

---

## Task 4: Implement CLI Tool
**Status:** Not Started  
**Priority:** P1  
**Estimate:** 20 min  
**Depends On:** Task 3

### Description
Create CLI entry point for Perplexica sync.

### Acceptance Criteria
- [ ] `bin/sync-perplexica.ts` created
- [ ] Supports `--verbose` flag
- [ ] Supports `--dry-run` flag
- [ ] Supports `--perplexica-url <url>` flag
- [ ] Supports `--embedding-model <model>` flag
- [ ] Supports `--embedding-provider <provider>` flag
- [ ] Reports success/failure with counts
- [ ] Exit code 0 on success, 1 on failure
- [ ] `sync:perplexica` script added to package.json

### Implementation
```typescript
// bin/sync-perplexica.ts
#!/usr/bin/env tsx
import { PerplexicaSyncer } from '../src/utils/perplexica-sync.js';

const args = process.argv.slice(2);
const verbose = args.includes('--verbose');
const dryRun = args.includes('--dry-run');

// Parse flags...

async function main() {
  const syncer = new PerplexicaSyncer({ /* config */ });
  const result = await syncer.sync({ dryRun });
  
  console.log(`Synced: ${result.newDocumentsSynced}, Skipped: ${result.skippedDocuments}`);
  process.exit(result.success ? 0 : 1);
}

main().catch(console.error);
```

---

## Task 5: Write Unit Tests
**Status:** Not Started  
**Priority:** P1  
**Estimate:** 45 min  
**Depends On:** Task 3

### Description
Create comprehensive unit tests for PerplexicaSyncer.

### Acceptance Criteria
- [ ] Test file created at `src/utils/__tests__/perplexica-sync.test.ts`
- [ ] Test sync state load/save
- [ ] Test document conversion format
- [ ] Test deduplication (isAlreadySynced)
- [ ] Test upload with mocked fetch
- [ ] Test error handling (Perplexica down, 400/500 errors)
- [ ] Test batch handling
- [ ] 80%+ coverage on perplexica-sync.ts

### Test Cases
1. `loadSyncState` returns empty state when file doesn't exist
2. `loadSyncState` parses existing JSON state
3. `saveSyncState` writes state to disk
4. `convertToTextFile` generates correct text format and filename
5. `isAlreadySynced` returns true for synced IDs
6. `isAlreadySynced` returns false for new IDs
7. `uploadDocuments` sends correct FormData to /api/uploads
8. `uploadDocuments` handles success response
9. `uploadDocuments` handles error response
10. `sync` skips already-synced documents
11. `sync` updates sync state after successful upload
12. `sync` respects dry-run mode

---

## Task 6: Manual Integration Test
**Status:** Not Started  
**Priority:** P2  
**Estimate:** 15 min  
**Depends On:** Task 4

### Description
Verify sync works against live Perplexica instance.

### Acceptance Criteria
- [ ] Perplexica running on localhost:3001
- [ ] Embedding model configured (Ollama with nomic-embed-text)
- [ ] Run `pnpm sync:perplexica --verbose`
- [ ] Documents appear in Perplexica library
- [ ] Re-run sync, verify no duplicates

---

## Summary

| Task | Priority | Estimate | Dependencies |
|------|----------|----------|--------------|
| 1. Type Definitions | P0 | 15 min | - |
| 2. Configuration | P0 | 10 min | 1 |
| 3. PerplexicaSyncer Class | P0 | 45 min | 1, 2 |
| 4. CLI Tool | P1 | 20 min | 3 |
| 5. Unit Tests | P1 | 45 min | 3 |
| 6. Integration Test | P2 | 15 min | 4 |

**Total Estimated Time: 2.5 hours**
