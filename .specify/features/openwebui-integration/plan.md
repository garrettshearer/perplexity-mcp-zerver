# Implementation Plan: OpenWebUI RAG Integration

**Feature Branch**: `001-openwebui-rag-sync`  
**Spec**: [spec.md](./spec.md)  
**Created**: 2026-01-20  
**Status**: Ready for Implementation

---

## Technical Context

| Aspect | Value | Source |
|--------|-------|--------|
| Runtime | Node.js with Bun | [package.json](../../package.json) |
| HTTP Client | axios (already installed) | package.json dependencies |
| Test Framework | Vitest | package.json devDependencies |
| Module System | ESM (type: module) | package.json |
| Existing RAG | RagArchiver class at `src/server/modules/RagArchiver.ts` | codebase grep |
| Archive Format | JSONL at `data/rag_archive.jsonl` | CONFIG.RAG_ARCHIVE_PATH |
| Logging Pattern | `logInfo/logWarn/logError` to stderr | src/utils/logging.ts |
| Config Pattern | Environment variables via CONFIG object | src/server/config.ts |

---

USE OpenWebUI JWT TOKEN: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjIxZTdkZWIwLTk3ZGItNGQyMC1iNDEyLWVkODRmOGZkYjhkMiIsImV4cCI6MTc3MDUyOTYxNn0.nHbAk0PQnQBxzq9vSmySUWjeYLPoD2A0KSE5ZZ_0p1c

OR API KEY: sk-f0a8644b578143119918f46635fc1201

## Constitution Check

| Gate | Status | Notes |
|------|--------|-------|
| Follows existing patterns | ✅ | Uses axios, logging utilities, CONFIG pattern |
| No new dependencies | ✅ | axios already installed |
| Test coverage required | ✅ | Unit tests planned |
| ESM module imports | ✅ | All imports use .js extensions |
| stderr logging only | ✅ | Using existing logging.ts utilities |

---

## Phase 0: Research Summary

### OpenWebUI API Endpoints (Verified)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/files/` | POST | Upload file (multipart/form-data) |
| `/api/v1/files/{id}/process/status` | GET | Poll processing status |
| `/api/v1/knowledge/` | GET | List existing knowledge bases |
| `/api/v1/knowledge/create` | POST | Create new knowledge base |
| `/api/v1/knowledge/{id}/file/add` | POST | Associate file with knowledge base |

### Authentication

- Bearer token required in `Authorization` header
- Token obtained from OpenWebUI: Settings → Account → API Key

### Processing States

- `pending` - File uploaded, processing in progress
- `completed` - File ready to add to knowledge base
- `failed` - Processing error occurred

---

## Phase 1: Data Model

### New Types (`src/types/index.ts`)

```typescript
// ─── OPENWEBUI INTEGRATION TYPES ──────────────────────────────────────

/**
 * OpenWebUI configuration loaded from environment variables
 */
export interface OpenWebUIConfig {
  /** Base URL of OpenWebUI instance (default: http://localhost:8090) */
  url: string;
  /** API key for authentication (required) */
  apiKey: string;
  /** Knowledge base name to create/update (default: "Perplexity RAG Archive") */
  knowledgeBaseName: string;
}

/**
 * OpenWebUI file upload response
 */
export interface OpenWebUIFileResponse {
  id: string;
  filename: string;
  created_at?: string;
}

/**
 * OpenWebUI file processing status
 */
export interface OpenWebUIFileStatus {
  status: 'pending' | 'completed' | 'failed';
  error?: string;
}

/**
 * OpenWebUI knowledge base entity
 */
export interface OpenWebUIKnowledgeBase {
  id: string;
  name: string;
  description?: string;
  created_at?: string;
}

/**
 * Sync operation result
 */
export interface SyncResult {
  success: boolean;
  filesUploaded: number;
  knowledgeBaseName: string;
  knowledgeBaseId?: string;
  recordsProcessed: number;
  error?: string;
}
```

### Configuration Extension (`src/server/config.ts`)

```typescript
// OpenWebUI sync configuration
OPENWEBUI_URL: process.env["OPENWEBUI_URL"] || "http://localhost:8090",
OPENWEBUI_API_KEY: process.env["OPENWEBUI_API_KEY"] || "",
OPENWEBUI_KB_NAME: process.env["OPENWEBUI_KB_NAME"] || "Perplexity RAG Archive",

// Sync operation settings
OPENWEBUI_SYNC: {
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
  PROCESSING_TIMEOUT_MS: 300000, // 5 minutes
  POLL_INTERVAL_MS: 2000,
} as const,
```

---

## Phase 2: Implementation Tasks

### Task 1: Add OpenWebUI Types
**File**: `src/types/index.ts`  
**Effort**: Small  
**Dependencies**: None

Add the types defined in Phase 1 to the existing types barrel export.

**Acceptance**:
- Types compile without error
- Types exported from index.ts

---

### Task 2: Extend Configuration
**File**: `src/server/config.ts`  
**Effort**: Small  
**Dependencies**: None

Add OpenWebUI configuration constants to the CONFIG object.

**Acceptance**:
- Environment variables read correctly
- Defaults applied when not set
- TypeScript types inferred correctly

---

### Task 3: Create OpenWebUI Sync Module
**File**: `src/utils/openwebui-sync.ts` (new)  
**Effort**: Large  
**Dependencies**: Task 1, Task 2

Core sync implementation with these responsibilities:

```typescript
export class OpenWebUISyncer {
  constructor(config?: Partial<OpenWebUIConfig>);
  
  // Validate configuration (API key required)
  validateConfig(): void;
  
  // Upload JSONL file to OpenWebUI
  uploadFile(filePath: string): Promise<OpenWebUIFileResponse>;
  
  // Poll for file processing completion
  waitForProcessing(fileId: string): Promise<OpenWebUIFileStatus>;
  
  // Find or create knowledge base by name
  getOrCreateKnowledgeBase(name: string): Promise<OpenWebUIKnowledgeBase>;
  
  // Associate uploaded file with knowledge base
  addFileToKnowledgeBase(knowledgeBaseId: string, fileId: string): Promise<void>;
  
  // Main sync orchestration
  sync(): Promise<SyncResult>;
}
```

**Implementation Details**:

1. **HTTP Client Setup**
   - Use axios with Bearer token header
   - Configure timeout from CONFIG
   - Handle network errors with retry logic

2. **File Upload**
   - Read JSONL file using fs.readFile
   - Create FormData with file content
   - POST to `/api/v1/files/` endpoint
   - Return file ID for status polling

3. **Status Polling**
   - Poll `/api/v1/files/{id}/process/status` every 2 seconds
   - Timeout after 5 minutes (configurable)
   - Handle `failed` status with error message

4. **Knowledge Base Management**
   - GET `/api/v1/knowledge/` to list existing
   - Match by name, return ID if found
   - POST `/api/v1/knowledge/create` if not found

5. **File Association**
   - POST `/api/v1/knowledge/{id}/file/add`
   - JSON body: `{ file_id: "..." }`

6. **Retry Logic**
   - Exponential backoff: 1s, 2s, 4s
   - Max 3 retries for 5xx errors and timeouts
   - Immediate fail for 4xx client errors

7. **Idempotency Detection**
   - Store last sync timestamp in `.sync-state.json`
   - Compare archive mtime before uploading
   - Skip if unchanged (report "Already up to date")

**Acceptance**:
- All methods implemented
- Retry logic works for transient errors
- Clear error messages for config issues
- Progress logged to stderr

---

### Task 4: Create CLI Entry Point
**File**: `bin/sync-openwebui.ts` (new)  
**Effort**: Medium  
**Dependencies**: Task 3

CLI script for manual sync execution:

```typescript
#!/usr/bin/env bun
import { OpenWebUISyncer } from "../src/utils/openwebui-sync.js";
import { logInfo, logError } from "../src/utils/logging.js";

async function main() {
  try {
    logInfo("Starting OpenWebUI RAG sync...");
    
    const syncer = new OpenWebUISyncer();
    syncer.validateConfig(); // Throws if API key missing
    
    const result = await syncer.sync();
    
    if (result.success) {
      logInfo(`Sync completed successfully!`);
      logInfo(`  Knowledge Base: ${result.knowledgeBaseName}`);
      logInfo(`  Files Uploaded: ${result.filesUploaded}`);
      logInfo(`  Records Processed: ${result.recordsProcessed}`);
      process.exit(0);
    } else {
      logError(`Sync failed: ${result.error}`);
      process.exit(1);
    }
  } catch (error) {
    logError(`Fatal error: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

main();
```

**Acceptance**:
- Executable with `bun bin/sync-openwebui.ts`
- Clear output on success and failure
- Non-zero exit code on error

---

### Task 5: Add npm Script
**File**: `package.json`  
**Effort**: Trivial  
**Dependencies**: Task 4

Add script entry:

```json
{
  "scripts": {
    "sync:openwebui": "bun bin/sync-openwebui.ts"
  }
}
```

**Acceptance**:
- `pnpm sync:openwebui` works
- Script documented in README (future task)

---

### Task 6: Unit Tests
**File**: `src/__tests__/unit/openwebui-sync.test.ts` (new)  
**Effort**: Large  
**Dependencies**: Task 3

Test suites:

```typescript
describe("OpenWebUISyncer", () => {
  describe("validateConfig", () => {
    it("T001: throws when OPENWEBUI_API_KEY is not set");
    it("T002: uses default URL when OPENWEBUI_URL not set");
    it("T003: uses default KB name when OPENWEBUI_KB_NAME not set");
    it("T004: accepts custom config via constructor");
  });

  describe("uploadFile", () => {
    it("T005: uploads file successfully and returns file ID");
    it("T006: throws on missing archive file");
    it("T007: throws on network error");
    it("T008: handles authentication failure (401)");
  });

  describe("waitForProcessing", () => {
    it("T009: resolves when status becomes completed");
    it("T010: throws on failed status");
    it("T011: times out after configured duration");
    it("T012: retries on transient errors");
  });

  describe("getOrCreateKnowledgeBase", () => {
    it("T013: returns existing KB when name matches");
    it("T014: creates new KB when name not found");
    it("T015: handles empty KB list");
  });

  describe("addFileToKnowledgeBase", () => {
    it("T016: associates file with KB successfully");
    it("T017: handles duplicate file gracefully");
  });

  describe("sync", () => {
    it("T018: full sync flow succeeds with valid config");
    it("T019: reports 'Already up to date' when unchanged");
    it("T020: handles empty archive file");
    it("T021: handles malformed JSON lines gracefully");
    it("T022: retries on 5xx errors");
    it("T023: exits with error on permanent failure");
  });
});
```

**Mock Strategy**:
- Mock axios for all HTTP calls
- Mock fs for file operations
- Mock CONFIG for different configurations

**Acceptance**:
- All test cases pass
- Coverage > 80% for new code
- Tests run in < 5 seconds

---

## Dependency Graph

```
Task 1 (Types) ──┬──> Task 3 (Sync Module) ──> Task 4 (CLI) ──> Task 5 (npm script)
Task 2 (Config) ─┘                        └──> Task 6 (Tests)
```

---

## Implementation Order

| Order | Task | File | Est. Time |
|-------|------|------|-----------|
| 1 | Add Types | src/types/index.ts | 15 min |
| 2 | Extend Config | src/server/config.ts | 10 min |
| 3 | Sync Module | src/utils/openwebui-sync.ts | 2-3 hours |
| 4 | CLI Entry | bin/sync-openwebui.ts | 30 min |
| 5 | npm Script | package.json | 5 min |
| 6 | Unit Tests | src/__tests__/unit/openwebui-sync.test.ts | 1-2 hours |

**Total Estimated Time**: 4-6 hours

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| OpenWebUI API changes | Low | High | Pin to known-working endpoints, add integration test |
| Large file memory issues | Medium | Medium | Implement streaming upload for files > 50MB |
| Processing timeout | Low | Medium | Make timeout configurable, provide clear feedback |
| Auth token expiry | Low | Low | Clear error message with re-auth instructions |

---

## Future Enhancements (Out of Scope for MVP)

- [ ] Scheduled automatic sync via cron expression
- [ ] Selective sync by date range
- [ ] Delta sync (only new records)
- [ ] Multiple knowledge base support
- [ ] Sync status dashboard in VSCode

---

## Checklist Before Implementation

- [x] Spec reviewed and understood
- [x] OpenWebUI API endpoints verified
- [x] Existing codebase patterns identified
- [x] Dependencies available (axios)
- [x] Test strategy defined
- [ ] Feature branch created

---

## Notes

**API Key Setup**: Users need to obtain their API key from OpenWebUI:
1. Open OpenWebUI in browser
2. Go to Settings → Account
3. Generate/copy API key
4. Set `OPENWEBUI_API_KEY` environment variable

USE OpenWebUI JWT TOKEN: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjIxZTdkZWIwLTk3ZGItNGQyMC1iNDEyLWVkODRmOGZkYjhkMiIsImV4cCI6MTc3MDUyOTYxNn0.nHbAk0PQnQBxzq9vSmySUWjeYLPoD2A0KSE5ZZ_0p1c

OR API KEY: sk-f0a8644b578143119918f46635fc1201


**Default Behavior**:
- URL defaults to `http://localhost:8090` (standard Docker port)
- Knowledge base named "Perplexity RAG Archive"
- File processing timeout: 5 minutes
- Max retries: 3 with exponential backoff
