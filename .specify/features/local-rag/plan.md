# Implementation Plan: Local RAG Storage

**Branch**: `local-rag` | **Date**: 2026-01-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/local-rag/spec.md`

## Summary

Implement automatic JSONL archival of all Perplexity interactions (user prompts + assistant responses) for consumption by local RAG systems (LangChain, LlamaIndex, OpenWebUI, Perplexica). The system appends `RagDocument` entries to a configurable file path using atomic POSIX append operations, ensuring data integrity under concurrent load while never blocking or failing primary search functionality.

## Technical Context

**Language/Version**: TypeScript 5.x (ESM modules, `.js` extensions in imports)  
**Primary Dependencies**: Node.js `fs/promises` for atomic `appendFile`, `crypto.randomUUID()` for IDs  
**Storage**: JSONL file (`./data/rag_archive.jsonl` or `RAG_ARCHIVE_PATH` env var)  
**Testing**: Vitest (unit tests with mocked fs operations)  
**Target Platform**: Node.js runtime (Linux, macOS, WSL2 - POSIX semantics)  
**Project Type**: Single MCP server project  
**Performance Goals**: Archive writes must not add >10ms latency to search response  
**Constraints**: Non-blocking writes; archive failures must not crash server or affect search  
**Scale/Scope**: Single file append-only; external tools handle rotation/management  

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| **Simplicity** | ✅ PASS | Single module (RagArchiver), single responsibility |
| **Test-First** | ✅ PASS | Unit tests designed before implementation |
| **Observability** | ✅ PASS | Uses existing `logError()` to stderr |
| **No stdout pollution** | ✅ PASS | All logging via `console.error` (MCP-safe) |
| **Graceful degradation** | ✅ PASS | Archive failures logged, don't crash server |

## Project Structure

### Documentation (this feature)

```text
.specify/features/local-rag/
├── spec.md              # Feature specification
├── plan.md              # This file (implementation plan)
├── research.md          # Phase 0 output (not needed - straightforward)
├── data-model.md        # Phase 1 output (RagDocument schema)
└── checklists/          # Task tracking
```

### Source Code Changes

```text
src/
├── types/
│   └── index.ts              # ADD: RagDocument interface export
├── server/
│   ├── config.ts             # ADD: RAG_ARCHIVE_PATH config
│   └── modules/
│       └── RagArchiver.ts    # NEW: Archive module (ensureDir, log, append)
├── tools/
│   └── chatPerplexity.ts     # MODIFY: Hook archiver after search
└── __tests__/
    └── unit/
        └── rag-archiver.test.ts  # NEW: Unit tests for RagArchiver
```

**Structure Decision**: Follows existing module pattern (`src/server/modules/*.ts`) with interface in `src/types/index.ts`.

---

## Phase 0: Research (Completed Inline)

No external research required - uses standard Node.js APIs:

| Topic | Decision | Rationale |
|-------|----------|-----------|
| **File API** | `fs/promises.appendFile()` | Atomic append, non-blocking, POSIX-safe |
| **UUID generation** | `crypto.randomUUID()` | Built-in, RFC 4122 compliant |
| **Directory creation** | `fs/promises.mkdir({ recursive: true })` | Idempotent, creates parent dirs |
| **Error handling** | Try-catch with `logError()` | Non-blocking, MCP-safe |

---

## Phase 1: Data Model & Contracts

### RagDocument Schema (data-model.md)

```typescript
/**
 * RagDocument - Archive record for a single Perplexity message
 * Compatible with LangChain JSONL loader, LlamaIndex JSONReader
 */
export interface RagDocument {
  /** Unique UUID for this message (RFC 4122) */
  id: string;
  
  /** Full Perplexity URL identifying the conversation */
  chat_id: string;
  
  /** ISO 8601 datetime when message was recorded */
  timestamp: string;
  
  /** Message author: "user" or "assistant" */
  role: "user" | "assistant";
  
  /** Full text content of the message */
  content: string;
  
  /** Additional context */
  metadata: RagDocumentMetadata;
}

export interface RagDocumentMetadata {
  /** Always "perplexity-mcp-zerver" */
  source: "perplexity-mcp-zerver";
  
  /** AI model used (when available) */
  model?: string;
  
  /** Research mode: "search" | "deep-research" (when specified) */
  research_mode?: "search" | "deep-research";
  
  /** Citation URLs from assistant response (assistant role only) */
  citations?: string[];
}
```

### JSONL Output Format

```jsonl
{"id":"550e8400-e29b-41d4-a716-446655440000","chat_id":"https://www.perplexity.ai/search/abc123","timestamp":"2026-01-20T14:30:00.000Z","role":"user","content":"What is quantum computing?","metadata":{"source":"perplexity-mcp-zerver"}}
{"id":"550e8400-e29b-41d4-a716-446655440001","chat_id":"https://www.perplexity.ai/search/abc123","timestamp":"2026-01-20T14:30:05.000Z","role":"assistant","content":"Quantum computing is...","metadata":{"source":"perplexity-mcp-zerver","citations":["https://en.wikipedia.org/wiki/Quantum_computing"]}}
```

---

## Phase 2: Implementation Tasks

### Task 1: Add RagDocument Interface (P1)
**File**: `src/types/index.ts`  
**Effort**: 15 min  
**Dependencies**: None

Add `RagDocument` and `RagDocumentMetadata` interfaces with JSDoc comments. Export from barrel file.

**Acceptance**: 
- Types compile without errors
- Exported from `src/types/index.ts`

---

### Task 2: Add RAG_ARCHIVE_PATH Config (P2)
**File**: `src/server/config.ts`  
**Effort**: 10 min  
**Dependencies**: None

Add to `CONFIG` object:
```typescript
RAG_ARCHIVE_PATH: process.env["RAG_ARCHIVE_PATH"] || "./data/rag_archive.jsonl",
```

**Acceptance**:
- Config reads from env var when set
- Defaults to `./data/rag_archive.jsonl`

---

### Task 3: Create RagArchiver Module (P1)
**File**: `src/server/modules/RagArchiver.ts`  
**Effort**: 45 min  
**Dependencies**: Task 1, Task 2

```typescript
export class RagArchiver {
  private readonly archivePath: string;
  private initialized = false;

  constructor(customPath?: string);
  
  /** Create archive directory if needed */
  async ensureDirectory(): Promise<void>;
  
  /** Archive a single RagDocument (non-blocking) */
  async log(doc: Omit<RagDocument, "id" | "timestamp">): Promise<void>;
  
  /** Archive user message + assistant response pair */
  async logInteraction(
    chatUrl: string,
    userMessage: string,
    assistantResponse: string,
    metadata?: { model?: string; research_mode?: ResearchMode; citations?: string[] }
  ): Promise<void>;
}
```

**Key Implementation Details**:
- Use `fs/promises.appendFile()` for atomic writes
- Generate UUID with `crypto.randomUUID()`
- Timestamp with `new Date().toISOString()`
- Wrap all I/O in try-catch, call `logError()` on failure
- Never throw - archive failures are silent to callers

**Acceptance**:
- Creates directory if missing
- Appends valid JSONL lines
- Survives permission errors without crashing

---

### Task 4: Write Unit Tests for RagArchiver (P1)
**File**: `src/__tests__/unit/rag-archiver.test.ts`  
**Effort**: 60 min  
**Dependencies**: Task 3 (TDD: write tests first, then implement)

Test cases:
1. **Constructor**: Creates instance with default/custom path
2. **ensureDirectory**: Creates nested directories
3. **ensureDirectory**: No-op when directory exists
4. **log**: Appends valid JSONL to file
5. **log**: Generates unique UUID per entry
6. **log**: Includes ISO 8601 timestamp
7. **logInteraction**: Creates 2 entries (user + assistant)
8. **logInteraction**: Includes citations in assistant metadata
9. **Error handling**: Logs error on permission failure
10. **Error handling**: Does not throw on write failure
11. **Concurrent writes**: Multiple rapid calls produce valid JSONL

**Mock Strategy**: Mock `fs/promises` module (same pattern as database.test.ts)

**Acceptance**:
- All 11 test cases pass
- Coverage >80% for RagArchiver.ts

---

### Task 5: Integrate RagArchiver into chatPerplexity (P1)
**File**: `src/tools/chatPerplexity.ts`  
**Effort**: 30 min  
**Dependencies**: Task 3

**Integration Point**: After `performSearch()` returns, before returning result to caller.

```typescript
// After search completes successfully
const searchResult = await performSearch(conversationPrompt, ctx);

// Archive interaction (fire-and-forget, non-blocking)
ragArchiver.logInteraction(
  searchResult.url,      // chat_id = Perplexity URL
  message,               // user prompt
  searchResult.answer,   // assistant response
  {
    citations: searchResult.citations,
    model: model,        // if specified
    // research_mode: from args if added
  }
).catch(() => {}); // Swallow errors - archival must not block response

return searchResult;
```

**Signature Change Required**: `chatPerplexity()` needs access to `RagArchiver` instance.

**Option A (Recommended)**: Add `ragArchiver` parameter to function signature  
**Option B**: Import singleton from module scope

**Acceptance**:
- Search result returned immediately (no blocking)
- JSONL entry appears in archive file
- Search works normally if archive fails

---

### Task 6: Update chatPerplexity Function Signature (P1)
**File**: `src/tools/chatPerplexity.ts` + `src/server/toolHandlerSetup.ts`  
**Effort**: 20 min  
**Dependencies**: Task 5

Add optional `ragArchiver?: RagArchiver` parameter to `chatPerplexity()`.

Update tool handler setup to instantiate and inject `RagArchiver`:
```typescript
const ragArchiver = new RagArchiver();
await ragArchiver.ensureDirectory();
// Pass to chatPerplexity tool handler
```

**Acceptance**:
- RagArchiver instantiated once at server startup
- Injected into chatPerplexity handler
- Backward compatible (archiver optional)

---

### Task 7: End-to-End Validation (P3)
**Manual Testing**  
**Effort**: 20 min  
**Dependencies**: All above tasks

1. Start server with default config
2. Execute `chat_perplexity` tool call
3. Verify `./data/rag_archive.jsonl` contains 2 entries
4. Parse entries with `jq` to validate JSON structure
5. Set `RAG_ARCHIVE_PATH=/tmp/custom.jsonl` and repeat
6. Verify custom path works

---

## Dependency Graph

```
Task 1 (types) ──┬──→ Task 3 (RagArchiver) ──→ Task 4 (tests)
                 │                              ↓
Task 2 (config) ─┘                        Task 5 (integration)
                                               ↓
                                          Task 6 (wiring)
                                               ↓
                                          Task 7 (E2E)
```

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| **Disk full** | `logError()` + swallow exception; search continues |
| **Permission denied** | Validate path on startup; `logWarn()` if unwritable |
| **Concurrent corruption** | POSIX `appendFile` is atomic for reasonable sizes |
| **Memory pressure** | Fire-and-forget (no await); GC handles cleanup |
| **Missing citations** | Optional field; empty array if unavailable |

## Success Metrics

- [ ] **SC-001**: 100% of successful searches produce 2 JSONL entries
- [ ] **SC-002**: All entries pass RagDocument schema validation
- [ ] **SC-003**: File parseable by `jq -c '.' archive.jsonl` (line-by-line)
- [ ] **SC-004**: Server startup <100ms increase
- [ ] **SC-005**: Archive write failure does not affect search response time
- [ ] **SC-006**: File loadable by LangChain `JSONLoader`
- [ ] **SC-007**: 10 concurrent searches produce 20 valid entries

---

## Appendix: File Diffs Preview

### src/types/index.ts (additions)
```typescript
// ─── RAG DOCUMENT TYPES ───────────────────────────────────────────────
export interface RagDocumentMetadata {
  source: "perplexity-mcp-zerver";
  model?: string;
  research_mode?: ResearchMode;
  citations?: string[];
}

export interface RagDocument {
  id: string;
  chat_id: string;
  timestamp: string;
  role: "user" | "assistant";
  content: string;
  metadata: RagDocumentMetadata;
}
```

### src/server/config.ts (additions)
```typescript
// RAG Archive configuration
RAG_ARCHIVE_PATH: process.env["RAG_ARCHIVE_PATH"] || "./data/rag_archive.jsonl",
```

---

**Plan Status**: Ready for implementation  
**Next Step**: Run `/speckit.tasks` to generate task checklist files
