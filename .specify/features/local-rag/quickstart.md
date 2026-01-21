# Quickstart: Local RAG Storage

**Feature**: Local RAG Storage  
**Date**: 2026-01-20  
**Time to implement**: ~3 hours

## Prerequisites

- Node.js 18+ with ESM support
- Existing perplexity-mcp-zerver codebase
- Vitest for testing

## Implementation Order

```
1. Types (15 min) → 2. Config (10 min) → 3. RagArchiver (45 min) → 4. Tests (60 min) → 5. Integration (30 min)
```

## Step 1: Add Types

**File**: `src/types/index.ts`

Add after the existing type exports:

```typescript
// ─── RAG DOCUMENT TYPES ───────────────────────────────────────────────
/**
 * Metadata for RAG document provenance and retrieval
 */
export interface RagDocumentMetadata {
  /** Always "perplexity-mcp-zerver" */
  source: "perplexity-mcp-zerver";
  /** AI model used (when specified) */
  model?: string;
  /** Research mode: "search" | "deep-research" */
  research_mode?: ResearchMode;
  /** Citation URLs from assistant response */
  citations?: string[];
}

/**
 * Archive record for a single Perplexity message
 * Compatible with LangChain JSONL loader
 */
export interface RagDocument {
  /** Unique UUID for this message */
  id: string;
  /** Full Perplexity URL identifying the conversation */
  chat_id: string;
  /** ISO 8601 datetime when recorded */
  timestamp: string;
  /** Message author */
  role: "user" | "assistant";
  /** Full text content */
  content: string;
  /** Additional context */
  metadata: RagDocumentMetadata;
}
```

## Step 2: Add Config

**File**: `src/server/config.ts`

Add to the `CONFIG` object:

```typescript
// RAG Archive configuration
RAG_ARCHIVE_PATH: process.env["RAG_ARCHIVE_PATH"] || "./data/rag_archive.jsonl",
```

## Step 3: Create RagArchiver Module

**File**: `src/server/modules/RagArchiver.ts`

```typescript
/**
 * RagArchiver - Handles JSONL archival of Perplexity interactions
 * Non-blocking, fire-and-forget design for RAG system consumption
 */
import { mkdir } from "node:fs/promises";
import { appendFile } from "node:fs/promises";
import { dirname } from "node:path";
import crypto from "node:crypto";

import type { RagDocument, RagDocumentMetadata, ResearchMode } from "../../types/index.js";
import { logError, logInfo } from "../../utils/logging.js";
import { CONFIG } from "../config.js";

export class RagArchiver {
  private readonly archivePath: string;
  private initialized = false;

  constructor(customPath?: string) {
    this.archivePath = customPath || CONFIG.RAG_ARCHIVE_PATH;
  }

  /**
   * Ensure archive directory exists (call once at startup)
   */
  async ensureDirectory(): Promise<void> {
    try {
      const dir = dirname(this.archivePath);
      await mkdir(dir, { recursive: true });
      this.initialized = true;
      logInfo(`RAG archive directory ready: ${dir}`);
    } catch (error) {
      logError("Failed to create RAG archive directory:", {
        error: error instanceof Error ? error.message : String(error),
        path: this.archivePath,
      });
      // Don't throw - archival is optional
    }
  }

  /**
   * Append a single RagDocument to the archive
   * Non-blocking, swallows errors to avoid affecting primary functionality
   */
  async log(doc: Omit<RagDocument, "id" | "timestamp">): Promise<void> {
    const fullDoc: RagDocument = {
      ...doc,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };

    try {
      const line = JSON.stringify(fullDoc) + "\n";
      await appendFile(this.archivePath, line, "utf-8");
    } catch (error) {
      logError("Failed to write RAG archive entry:", {
        error: error instanceof Error ? error.message : String(error),
        role: doc.role,
        chat_id: doc.chat_id,
      });
      // Swallow error - archival must not block primary functionality
    }
  }

  /**
   * Archive a complete user/assistant interaction pair
   * Convenience method that creates two RagDocument entries
   */
  async logInteraction(
    chatUrl: string,
    userMessage: string,
    assistantResponse: string,
    options?: {
      model?: string;
      research_mode?: ResearchMode;
      citations?: string[];
    }
  ): Promise<void> {
    const baseMetadata: RagDocumentMetadata = {
      source: "perplexity-mcp-zerver",
    };

    if (options?.model) {
      baseMetadata.model = options.model;
    }
    if (options?.research_mode) {
      baseMetadata.research_mode = options.research_mode;
    }

    // Log user message
    await this.log({
      chat_id: chatUrl,
      role: "user",
      content: userMessage,
      metadata: baseMetadata,
    });

    // Log assistant response with citations
    const assistantMetadata: RagDocumentMetadata = {
      ...baseMetadata,
    };
    if (options?.citations && options.citations.length > 0) {
      assistantMetadata.citations = options.citations;
    }

    await this.log({
      chat_id: chatUrl,
      role: "assistant",
      content: assistantResponse,
      metadata: assistantMetadata,
    });
  }

  /**
   * Get the configured archive path (for testing/debugging)
   */
  getArchivePath(): string {
    return this.archivePath;
  }

  /**
   * Check if archiver has been initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}
```

## Step 4: Write Unit Tests

**File**: `src/__tests__/unit/rag-archiver.test.ts`

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RagArchiver } from "../../server/modules/RagArchiver.js";

// Mock fs/promises
vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  appendFile: vi.fn().mockResolvedValue(undefined),
}));

// Mock logging
vi.mock("../../utils/logging.js", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

// Mock config
vi.mock("../../server/config.js", () => ({
  CONFIG: {
    RAG_ARCHIVE_PATH: "./data/rag_archive.jsonl",
  },
}));

import { mkdir, appendFile } from "node:fs/promises";
import * as logging from "../../utils/logging.js";

const mockMkdir = vi.mocked(mkdir);
const mockAppendFile = vi.mocked(appendFile);
const mockLogError = vi.mocked(logging.logError);

describe("RagArchiver", () => {
  let archiver: RagArchiver;

  beforeEach(() => {
    vi.clearAllMocks();
    archiver = new RagArchiver();
  });

  describe("constructor", () => {
    it("should use default path from config", () => {
      expect(archiver.getArchivePath()).toBe("./data/rag_archive.jsonl");
    });

    it("should use custom path when provided", () => {
      const custom = new RagArchiver("/custom/path.jsonl");
      expect(custom.getArchivePath()).toBe("/custom/path.jsonl");
    });
  });

  describe("ensureDirectory", () => {
    it("should create directory recursively", async () => {
      await archiver.ensureDirectory();
      expect(mockMkdir).toHaveBeenCalledWith("./data", { recursive: true });
    });

    it("should set initialized flag on success", async () => {
      expect(archiver.isInitialized()).toBe(false);
      await archiver.ensureDirectory();
      expect(archiver.isInitialized()).toBe(true);
    });

    it("should not throw on mkdir failure", async () => {
      mockMkdir.mockRejectedValueOnce(new Error("Permission denied"));
      await expect(archiver.ensureDirectory()).resolves.not.toThrow();
      expect(mockLogError).toHaveBeenCalled();
    });
  });

  describe("log", () => {
    it("should append JSONL to file", async () => {
      await archiver.log({
        chat_id: "https://perplexity.ai/test",
        role: "user",
        content: "test message",
        metadata: { source: "perplexity-mcp-zerver" },
      });

      expect(mockAppendFile).toHaveBeenCalledWith(
        "./data/rag_archive.jsonl",
        expect.stringMatching(/^\{.*\}\n$/),
        "utf-8"
      );
    });

    it("should generate unique UUID", async () => {
      await archiver.log({
        chat_id: "https://perplexity.ai/test",
        role: "user",
        content: "test",
        metadata: { source: "perplexity-mcp-zerver" },
      });

      const call = mockAppendFile.mock.calls[0][1] as string;
      const doc = JSON.parse(call.trim());
      expect(doc.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it("should include ISO timestamp", async () => {
      await archiver.log({
        chat_id: "https://perplexity.ai/test",
        role: "assistant",
        content: "response",
        metadata: { source: "perplexity-mcp-zerver" },
      });

      const call = mockAppendFile.mock.calls[0][1] as string;
      const doc = JSON.parse(call.trim());
      expect(doc.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it("should not throw on write failure", async () => {
      mockAppendFile.mockRejectedValueOnce(new Error("Disk full"));
      await expect(
        archiver.log({
          chat_id: "test",
          role: "user",
          content: "test",
          metadata: { source: "perplexity-mcp-zerver" },
        })
      ).resolves.not.toThrow();
      expect(mockLogError).toHaveBeenCalled();
    });
  });

  describe("logInteraction", () => {
    it("should create two entries (user + assistant)", async () => {
      await archiver.logInteraction(
        "https://perplexity.ai/search/abc",
        "user question",
        "assistant answer"
      );

      expect(mockAppendFile).toHaveBeenCalledTimes(2);
    });

    it("should include citations in assistant metadata", async () => {
      await archiver.logInteraction(
        "https://perplexity.ai/search/abc",
        "question",
        "answer",
        { citations: ["https://example.com"] }
      );

      const assistantCall = mockAppendFile.mock.calls[1][1] as string;
      const doc = JSON.parse(assistantCall.trim());
      expect(doc.metadata.citations).toEqual(["https://example.com"]);
    });

    it("should include model when specified", async () => {
      await archiver.logInteraction(
        "https://perplexity.ai/search/abc",
        "question",
        "answer",
        { model: "Claude 3.5 Sonnet" }
      );

      const userCall = mockAppendFile.mock.calls[0][1] as string;
      const doc = JSON.parse(userCall.trim());
      expect(doc.metadata.model).toBe("Claude 3.5 Sonnet");
    });
  });
});
```

## Step 5: Integrate with chatPerplexity

**File**: `src/tools/chatPerplexity.ts`

Add import and optional parameter:

```typescript
import type { RagArchiver } from "../server/modules/RagArchiver.js";

export default async function chatPerplexity(
  args: { message: string; chat_id?: string; chat_url?: string; space_id?: string; model?: string },
  ctx: PuppeteerContext,
  performSearch: (prompt: string, ctx: PuppeteerContext) => Promise<string>,
  getChatHistory: (chat_id: string) => ChatMessage[],
  saveChatMessage: (chat_id: string, message: ChatMessage) => void,
  ragArchiver?: RagArchiver, // NEW: Optional RAG archiver
): Promise<string> {
```

After search completes, add archival (fire-and-forget):

```typescript
const result = await performSearch(conversationPrompt, ctx);

// Archive interaction for RAG (non-blocking)
if (ragArchiver) {
  ragArchiver.logInteraction(
    pageUrl,  // chat_id from SearchResult.url
    message,
    result,
    { model, citations: searchResult.citations }
  ).catch(() => {}); // Swallow errors
}

return result;
```

## Validation Commands

```bash
# Run unit tests
pnpm test src/__tests__/unit/rag-archiver.test.ts

# Type check
pnpm tsc --noEmit

# Lint
pnpm lint

# Manual E2E test
RAG_ARCHIVE_PATH=/tmp/test-rag.jsonl pnpm dev
# Execute chat_perplexity tool
cat /tmp/test-rag.jsonl | jq -c '.'
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `ENOENT: no such file or directory` | Call `ensureDirectory()` before first log |
| `EACCES: permission denied` | Check write permissions on archive path |
| No entries appearing | Verify `ragArchiver` is passed to chatPerplexity |
| Invalid JSON in file | Check for concurrent non-atomic writes (shouldn't happen with appendFile) |

---

**Implementation Complete When**:
- [ ] `pnpm test` passes with new tests
- [ ] `pnpm tsc --noEmit` has no errors  
- [ ] Manual search produces 2 JSONL entries
- [ ] `jq` can parse all lines in archive file
