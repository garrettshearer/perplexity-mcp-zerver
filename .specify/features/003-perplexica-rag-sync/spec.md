# Perplexica RAG Sync Feature Specification

## Overview

Enable automatic synchronization of locally archived RAG documents (JSONL) to Perplexica's document storage for enhanced local AI search capabilities.

## Problem Statement

The perplexity-mcp-zerver stores valuable search results and chat interactions in a local JSONL archive (`data/rag_archive.jsonl`). Users running Perplexica locally want to leverage this accumulated knowledge for private, local AI-powered search without re-querying external APIs.

**Challenge:** Perplexica does not expose a REST API for file uploads - it only supports file uploads through its web UI.

## Solution

Implement an **HTTP-based sync utility** using Perplexica's `POST /api/uploads` endpoint:
1. Reads the local JSONL archive
2. Converts documents to a format Perplexica can ingest (TXT)
3. Uploads files via HTTP multipart form data
4. Tracks which documents have been synced to avoid duplicates

**Discovery:** Perplexica exposes a REST API at `/api/uploads` that accepts FormData with:
- `files` - File objects
- `embedding_model_key` - Model name (e.g., "nomic-embed-text")
- `embedding_model_provider_id` - Provider ID (e.g., "ollama")

## Requirements

### Functional Requirements

1. **FR-1: JSONL Parsing**
   - Read and parse `data/rag_archive.jsonl`
   - Extract searchable content from RagDocument records
   - Handle malformed JSON lines gracefully

2. **FR-2: Document Conversion**
   - Convert RagDocument to plain text format
   - Include metadata (source URL, timestamp, query)
   - Create meaningful filenames for organization

3. **FR-3: HTTP Upload**
   - Use fetch() with FormData to POST to /api/uploads
   - Configure embedding model and provider
   - Handle multipart file upload format
   - Verify upload success from response

4. **FR-4: Sync Tracking**
   - Track synced document IDs in persistent storage
   - Skip already-synced documents on subsequent runs
   - Support force-resync option

5. **FR-5: CLI Interface**
   - Provide `sync:perplexica` npm script
   - Support `--verbose` flag for detailed logging
   - Support `--dry-run` flag to preview actions
   - Support `--perplexica-url` flag (default: http://localhost:3001)

### Non-Functional Requirements

1. **NFR-1: Error Handling**
   - Graceful failure on Perplexica unavailability
   - Timeout handling for slow uploads
   - Retry logic for transient failures

2. **NFR-2: Performance**
   - Batch uploads to minimize browser overhead
   - Progress reporting for large archives

3. **NFR-3: Idempotency**
   - Re-running sync should not create duplicates
   - Sync state persisted between runs

## Technical Design

### Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  JSONL Archive  │───▶│  PerplexicaSyncer│───▶│   Perplexica    │
│  rag_archive.   │    │   (Puppeteer)    │    │   localhost:3001│
│  jsonl          │    └──────────────────┘    └─────────────────┘
└─────────────────┘             │
                                │
                    ┌───────────▼───────────┐
                    │  Sync State Tracker   │
                    │  data/perplexica_sync │
                    │  .json                │
                    └───────────────────────┘
```

### Module Structure

```
src/utils/
├── perplexica-sync.ts      # Main syncer class
└── index.ts                # Export syncer

bin/
└── sync-perplexica.ts      # CLI entry point

data/
├── rag_archive.jsonl       # Source (existing)
└── perplexica_sync.json    # Sync state tracking
```

### Key Classes

```typescript
interface PerplexicaSyncConfig {
  perplexicaUrl: string;      // Default: http://localhost:3001
  archivePath: string;        // Default: data/rag_archive.jsonl
  syncStatePath: string;      // Default: data/perplexica_sync.json
  headless: boolean;          // Default: true
  timeout: number;            // Default: 30000ms
}

interface PerplexicaSyncState {
  lastSyncTime: string;
  syncedDocumentIds: string[];
  totalSynced: number;
}

interface PerplexicaSyncResult {
  success: boolean;
  newDocumentsSynced: number;
  skippedDocuments: number;
  errors: string[];
}

class PerplexicaSyncer {
  constructor(config: Partial<PerplexicaSyncConfig>);
  
  // Core methods
  sync(): Promise<PerplexicaSyncResult>;
  uploadDocuments(docs: RagDocument[]): Promise<void>;
  
  // Helpers
  loadSyncState(): Promise<PerplexicaSyncState>;
  saveSyncState(state: PerplexicaSyncState): Promise<void>;
  convertToTextFile(doc: RagDocument): { content: string; filename: string };
  isAlreadySynced(docId: string): boolean;
}
```

## Acceptance Criteria

1. **AC-1:** Running `pnpm sync:perplexica` successfully uploads new documents to Perplexica
2. **AC-2:** Previously synced documents are skipped on subsequent runs
3. **AC-3:** `--dry-run` shows what would be synced without uploading
4. **AC-4:** Sync state persists between runs in `data/perplexica_sync.json`
5. **AC-5:** Graceful error messages when Perplexica is not running
6. **AC-6:** All tests pass with 80%+ coverage
7. **AC-7:** Supports configurable embedding model provider and model name

## Dependencies

- node-fetch or built-in fetch: HTTP uploads
- readline: For JSONL streaming (built-in)

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Perplexica API changes | Pin tested version, add version check |
| Large archives cause memory issues | Stream JSONL, batch uploads |
| Embedding model not configured | Clear error message with instructions |

## Out of Scope

- Real-time sync (on each search)
- Perplexica API contribution (future enhancement)
- Bidirectional sync (Perplexica → JSONL)
