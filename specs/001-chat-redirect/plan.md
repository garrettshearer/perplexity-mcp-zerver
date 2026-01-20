# Implementation Plan: Redirect to Existing Chat by URL

**Branch**: `001-chat-redirect` | **Date**: 2026-01-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-chat-redirect/spec.md`

## Summary

Implement URL-based chat session continuation for the Perplexity MCP tool. Users can provide a Perplexity chat URL (or just the chat ID) to resume an existing conversation without re-typing previous messages. The chat history is pre-loaded from the URL, and the textarea becomes ready for new follow-up messages.

**Technical Approach**: Add `extractChatId()` utility for URL parsing, `openPerplexityChat()` for direct navigation to chat URLs, and extend `chatPerplexity` tool with `chat_url` and `chat_id` parameters.

## Technical Context

**Language/Version**: TypeScript 5.x with Node.js ESM modules  
**Primary Dependencies**: Puppeteer (via puppeteer-extra with stealth), Vitest  
**Storage**: SQLite (existing chat message storage via `db.ts`)  
**Testing**: Vitest (unit + integration)  
**Target Platform**: MCP Server (Node.js runtime)  
**Project Type**: Single project (MCP server)  
**Performance Goals**: Navigate to existing chat within 5 seconds (excluding network latency)  
**Constraints**: 30s navigation timeout, 10s textarea wait timeout (per spec FR-009, FR-010)  
**Scale/Scope**: Single tool enhancement, 3 files modified + test files

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| No new dependencies | ✅ PASS | Uses existing Puppeteer, no new packages |
| Follows existing patterns | ✅ PASS | Mirrors `navigateToPerplexity()` pattern in puppeteer.ts |
| Unit tests required | ✅ PASS | Plan includes unit tests for `extractChatId()` and integration tests |
| Error handling | ✅ PASS | Spec defines timeout and error handling requirements |
| TypeScript strict mode | ✅ PASS | Will follow existing type patterns |

## Project Structure

### Documentation (this feature)

```text
specs/001-chat-redirect/
├── plan.md              # This file
├── spec.md              # Feature specification (exists)
├── research.md          # Phase 0 output (N/A - no unknowns)
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── contracts/           # Phase 1 output (tool schema updates)
```

### Source Code (repository root)

```text
src/
├── utils/
│   ├── extraction.ts     # ADD: extractChatId() function
│   └── puppeteer.ts      # ADD: openPerplexityChat() function
├── tools/
│   └── chatPerplexity.ts # MODIFY: Add chat_url/chat_id parameters
├── types/
│   └── tools.ts          # MODIFY: Update ChatPerplexityArgs interface
└── __tests__/
    └── unit/
        ├── extraction.test.ts  # ADD: extractChatId() tests
        └── chat-redirect.test.ts # ADD: openPerplexityChat() tests
```

**Structure Decision**: Single project structure maintained. New functions added to existing utility modules following established patterns.

## Complexity Tracking

> No violations - implementation uses existing infrastructure.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |

---

## Phase 0: Research (Complete)

**No NEEDS CLARIFICATION items identified.**

All technical questions are resolved by examining existing code:

| Topic | Finding | Source |
|-------|---------|--------|
| URL patterns | Perplexity uses `/search/{id}` and `/chat/{id}` | Spec FR-001 |
| Textarea selector | `'textarea[placeholder*="Ask"]'` (primary) | puppeteer-logic.ts#L181 |
| Navigation pattern | Use `page.goto()` with `waitUntil: "domcontentloaded"` | puppeteer.ts#L88 |
| Timeout values | Navigation: 30-45s, Selector: 10-15s | config.ts |
| Error handling | Throw descriptive errors, log via ctx.log() | Existing patterns |

---

## Phase 1: Design & Contracts

### 1.1 Data Model

**New Entity: None** - Uses existing `ChatMessage` and `PuppeteerContext` types.

**Updated Interface: `ChatPerplexityArgs`**

```typescript
// src/types/tools.ts
export interface ChatPerplexityArgs {
  message: string;
  chat_id?: string;
  chat_url?: string;  // NEW: Full Perplexity chat URL
}
```

### 1.2 API Contracts

#### Updated Tool Schema: `chat_perplexity`

```json
{
  "name": "chat_perplexity",
  "description": "Have a conversational interaction with Perplexity AI, optionally continuing an existing chat session",
  "inputSchema": {
    "type": "object",
    "properties": {
      "message": {
        "type": "string",
        "description": "The message to send to Perplexity"
      },
      "chat_id": {
        "type": "string",
        "description": "Optional: Chat session ID to continue (extracted from URL or provided directly)"
      },
      "chat_url": {
        "type": "string",
        "description": "Optional: Full Perplexity chat URL to continue (e.g., https://perplexity.ai/search/abc123). Takes precedence over chat_id."
      }
    },
    "required": ["message"]
  }
}
```

### 1.3 Function Signatures

#### `extractChatId()` - New function in `extraction.ts`

```typescript
/**
 * Extracts chat ID from various Perplexity URL formats
 * @param input - Full URL, partial URL, or raw chat ID
 * @returns Chat ID string or null if extraction fails
 * 
 * Supported formats:
 * - https://www.perplexity.ai/search/abc123-def456
 * - https://perplexity.ai/chat/xyz789
 * - perplexity.ai/search/abc123 (no protocol)
 * - abc123-def456 (raw ID passthrough)
 */
export function extractChatId(input: string): string | null;
```

#### `openPerplexityChat()` - New function in `puppeteer.ts`

```typescript
/**
 * Navigates directly to an existing Perplexity chat session
 * @param ctx - Puppeteer context with browser/page
 * @param chatId - The chat ID to navigate to
 * @returns Promise that resolves when chat is ready for input
 * @throws Error if navigation fails, chat not found, or timeout
 */
export async function openPerplexityChat(
  ctx: PuppeteerContext, 
  chatId: string
): Promise<void>;
```

---

## Phase 2: Implementation Tasks

### Task 2.1: Add `extractChatId()` to `extraction.ts`

**File**: `src/utils/extraction.ts`  
**Acceptance**: FR-001, User Story 2

```typescript
// Add after line 10 (existing imports)

/**
 * Regular expressions for extracting chat IDs from Perplexity URLs
 */
const PERPLEXITY_URL_PATTERNS = [
  /(?:https?:\/\/)?(?:www\.)?perplexity\.ai\/search\/([a-zA-Z0-9-]+)/,
  /(?:https?:\/\/)?(?:www\.)?perplexity\.ai\/chat\/([a-zA-Z0-9-]+)/,
];

/**
 * Validates if a string looks like a raw chat ID (alphanumeric with optional hyphens)
 */
const CHAT_ID_PATTERN = /^[a-zA-Z0-9-]+$/;

/**
 * Extracts chat ID from various Perplexity URL formats or validates raw ID
 */
export function extractChatId(input: string): string | null {
  if (!input || typeof input !== 'string') {
    return null;
  }

  const trimmed = input.trim();

  // Try URL patterns first
  for (const pattern of PERPLEXITY_URL_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  // Check if it's already a valid chat ID format
  if (CHAT_ID_PATTERN.test(trimmed) && !trimmed.includes('.')) {
    return trimmed;
  }

  return null;
}
```

### Task 2.2: Add `openPerplexityChat()` to `puppeteer.ts`

**File**: `src/utils/puppeteer.ts`  
**Acceptance**: FR-002, FR-003, FR-004, FR-009, FR-010

```typescript
// Add after navigateToPerplexity() function (~line 210)

/**
 * Navigates directly to an existing Perplexity chat session by ID
 * Chat history is pre-loaded by the URL - no message replay needed
 */
export async function openPerplexityChat(
  ctx: PuppeteerContext,
  chatId: string
): Promise<void> {
  const { page } = ctx;
  if (!page) throw new Error("Page not initialized");

  const chatUrl = `https://www.perplexity.ai/search/${chatId}`;
  logInfo(`Navigating to existing chat: ${chatUrl}`);

  try {
    // Navigate to chat URL (30 second timeout per FR-009)
    const response = await page.goto(chatUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // Check for HTTP errors
    if (response && !response.ok()) {
      const status = response.status();
      if (status === 404) {
        throw new Error(`Chat not found: ${chatId} - the chat may have been deleted or expired`);
      }
      throw new Error(`HTTP error ${status} when accessing chat: ${chatId}`);
    }

    // Validate we're on a Perplexity page
    const currentUrl = page.url();
    if (!currentUrl.includes("perplexity.ai")) {
      throw new Error(`Unexpected redirect to: ${currentUrl} - user may need to authenticate`);
    }

    // Wait for textarea to confirm chat is interactive (10 second timeout per FR-010)
    const selectors = getSearchInputSelectors();
    let textareaFound = false;
    
    for (const selector of selectors) {
      try {
        await page.waitForSelector(selector, { timeout: 10000 });
        textareaFound = true;
        logInfo(`Chat ready - textarea found with selector: ${selector}`);
        break;
      } catch {
        continue;
      }
    }

    if (!textareaFound) {
      throw new Error(
        `Chat loaded but textarea not found within 10 seconds - ` +
        `UI may have changed or chat may require authentication`
      );
    }

    logInfo(`Successfully opened chat: ${chatId}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    
    if (message.includes("timeout") || message.includes("Timeout")) {
      throw new Error(
        `Navigation timeout after 30 seconds - ` +
        `check network connection or try again later`
      );
    }
    
    throw error;
  }
}
```

### Task 2.3: Update `ChatPerplexityArgs` type

**File**: `src/types/tools.ts`  
**Acceptance**: FR-005, FR-006

```typescript
// Update existing interface (around line 28)
export interface ChatPerplexityArgs {
  message: string;
  chat_id?: string;
  chat_url?: string;  // NEW: Full Perplexity chat URL
}
```

### Task 2.4: Update `chatPerplexity` tool

**File**: `src/tools/chatPerplexity.ts`  
**Acceptance**: FR-005, FR-006, FR-007, FR-008, User Story 1, User Story 3

```typescript
/**
 * Tool implementation for chat functionality with Perplexity
 */

import crypto from "node:crypto";
import type { ChatMessage, PuppeteerContext } from "../types/index.js";
import { extractChatId } from "../utils/extraction.js";
import { openPerplexityChat } from "../utils/puppeteer.js";

/**
 * Handles chat interactions with conversation history
 * Supports continuing existing chats via URL or chat ID
 */
export default async function chatPerplexity(
  args: { message: string; chat_id?: string; chat_url?: string },
  ctx: PuppeteerContext,
  performSearch: (prompt: string, ctx: PuppeteerContext) => Promise<string>,
  getChatHistory: (chat_id: string) => ChatMessage[],
  saveChatMessage: (chat_id: string, message: ChatMessage) => void,
): Promise<string> {
  const { message, chat_url, chat_id: providedChatId } = args;
  
  // FR-007: chat_url takes precedence over chat_id
  let resolvedChatId: string | null = null;
  let isExistingChat = false;
  
  if (chat_url) {
    resolvedChatId = extractChatId(chat_url);
    if (!resolvedChatId) {
      throw new Error(
        `Invalid chat URL: ${chat_url}. ` +
        `Expected format: https://perplexity.ai/search/{chatId} or https://perplexity.ai/chat/{chatId}`
      );
    }
    isExistingChat = true;
  } else if (providedChatId) {
    resolvedChatId = extractChatId(providedChatId);
    if (!resolvedChatId) {
      throw new Error(
        `Invalid chat ID format: ${providedChatId}. ` +
        `Expected alphanumeric characters with optional hyphens.`
      );
    }
    isExistingChat = true;
  }
  
  // Generate new ID for fresh conversations
  const chatId = resolvedChatId ?? crypto.randomUUID();
  
  // Navigate to existing chat if URL/ID was provided
  if (isExistingChat && resolvedChatId) {
    await openPerplexityChat(ctx, resolvedChatId);
    // Note: For existing chats, history is pre-loaded by the URL
    // We don't replay messages - just send the new follow-up
  }
  
  // For new chats or follow-ups, build the conversation prompt
  const history = getChatHistory(chatId);
  const userMessage: ChatMessage = { role: "user", content: message };
  saveChatMessage(chatId, userMessage);

  let conversationPrompt = "";
  
  // Only include history context for new chats (existing chats have context from URL)
  if (!isExistingChat) {
    for (const msg of history) {
      conversationPrompt +=
        msg.role === "user" ? `User: ${msg.content}\n` : `Assistant: ${msg.content}\n`;
    }
  }
  
  conversationPrompt += `User: ${message}\n`;

  return await performSearch(conversationPrompt, ctx);
}
```

### Task 2.5: Add unit tests for `extractChatId()`

**File**: `src/__tests__/unit/extraction.test.ts`  
**Acceptance**: User Story 2 (all acceptance scenarios)

```typescript
// Add new describe block to existing extraction.test.ts

describe("extractChatId", () => {
  it("should extract chat ID from full search URL with protocol", async () => {
    const { extractChatId } = await import("../../utils/extraction.js");
    const result = extractChatId("https://www.perplexity.ai/search/abc123-def456");
    expect(result).toBe("abc123-def456");
  });

  it("should extract chat ID from chat URL", async () => {
    const { extractChatId } = await import("../../utils/extraction.js");
    const result = extractChatId("https://perplexity.ai/chat/xyz789");
    expect(result).toBe("xyz789");
  });

  it("should extract chat ID from URL without protocol", async () => {
    const { extractChatId } = await import("../../utils/extraction.js");
    const result = extractChatId("perplexity.ai/search/abc123");
    expect(result).toBe("abc123");
  });

  it("should pass through valid raw chat ID", async () => {
    const { extractChatId } = await import("../../utils/extraction.js");
    const result = extractChatId("abc123-def456");
    expect(result).toBe("abc123-def456");
  });

  it("should return null for invalid URL", async () => {
    const { extractChatId } = await import("../../utils/extraction.js");
    const result = extractChatId("https://example.com/something");
    expect(result).toBeNull();
  });

  it("should return null for empty input", async () => {
    const { extractChatId } = await import("../../utils/extraction.js");
    expect(extractChatId("")).toBeNull();
    expect(extractChatId("   ")).toBeNull();
  });

  it("should handle URL with www prefix", async () => {
    const { extractChatId } = await import("../../utils/extraction.js");
    const result = extractChatId("https://www.perplexity.ai/search/test123");
    expect(result).toBe("test123");
  });

  it("should handle URL without www prefix", async () => {
    const { extractChatId } = await import("../../utils/extraction.js");
    const result = extractChatId("https://perplexity.ai/search/test456");
    expect(result).toBe("test456");
  });
});
```

### Task 2.6: Add integration tests for `openPerplexityChat()`

**File**: `src/__tests__/unit/chat-redirect.test.ts` (new file)  
**Acceptance**: User Story 1, Edge Cases

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Page, HTTPResponse } from "puppeteer";
import type { PuppeteerContext } from "../../types/browser.js";

// Mock dependencies
vi.mock("../../utils/logging.js", () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("../../utils/puppeteer-logic.js", () => ({
  getSearchInputSelectors: vi.fn().mockReturnValue([
    'textarea[placeholder*="Ask"]',
    'textarea[placeholder*="Search"]',
  ]),
}));

describe("openPerplexityChat", () => {
  const mockResponse = {
    ok: vi.fn().mockReturnValue(true),
    status: vi.fn().mockReturnValue(200),
  } as unknown as HTTPResponse;

  const createMockPage = (overrides = {}) => ({
    goto: vi.fn().mockResolvedValue(mockResponse),
    url: vi.fn().mockReturnValue("https://www.perplexity.ai/search/test123"),
    waitForSelector: vi.fn().mockResolvedValue({}),
    isClosed: vi.fn().mockReturnValue(false),
    ...overrides,
  }) as unknown as Page;

  const createMockCtx = (page: Page) => ({
    page,
    browser: {} as any,
    log: vi.fn(),
    setBrowser: vi.fn(),
    setPage: vi.fn(),
    setIsInitializing: vi.fn(),
    isInitializing: false,
  }) as unknown as PuppeteerContext;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should navigate to chat URL and wait for textarea", async () => {
    const { openPerplexityChat } = await import("../../utils/puppeteer.js");
    const mockPage = createMockPage();
    const ctx = createMockCtx(mockPage);

    await openPerplexityChat(ctx, "test123");

    expect(mockPage.goto).toHaveBeenCalledWith(
      "https://www.perplexity.ai/search/test123",
      expect.objectContaining({
        waitUntil: "domcontentloaded",
        timeout: 30000,
      })
    );
    expect(mockPage.waitForSelector).toHaveBeenCalled();
  });

  it("should throw error for 404 response (chat not found)", async () => {
    const { openPerplexityChat } = await import("../../utils/puppeteer.js");
    const notFoundResponse = {
      ok: vi.fn().mockReturnValue(false),
      status: vi.fn().mockReturnValue(404),
    } as unknown as HTTPResponse;
    
    const mockPage = createMockPage({
      goto: vi.fn().mockResolvedValue(notFoundResponse),
    });
    const ctx = createMockCtx(mockPage);

    await expect(openPerplexityChat(ctx, "nonexistent"))
      .rejects.toThrow(/Chat not found.*deleted or expired/);
  });

  it("should throw error when redirected away from Perplexity (auth required)", async () => {
    const { openPerplexityChat } = await import("../../utils/puppeteer.js");
    const mockPage = createMockPage({
      url: vi.fn().mockReturnValue("https://auth.example.com/login"),
    });
    const ctx = createMockCtx(mockPage);

    await expect(openPerplexityChat(ctx, "test123"))
      .rejects.toThrow(/Unexpected redirect.*authenticate/);
  });

  it("should throw error when textarea not found within timeout", async () => {
    const { openPerplexityChat } = await import("../../utils/puppeteer.js");
    const mockPage = createMockPage({
      waitForSelector: vi.fn().mockRejectedValue(new Error("Timeout")),
    });
    const ctx = createMockCtx(mockPage);

    await expect(openPerplexityChat(ctx, "test123"))
      .rejects.toThrow(/textarea not found/);
  });

  it("should throw error when page is not initialized", async () => {
    const { openPerplexityChat } = await import("../../utils/puppeteer.js");
    const ctx = { page: null } as unknown as PuppeteerContext;

    await expect(openPerplexityChat(ctx, "test123"))
      .rejects.toThrow("Page not initialized");
  });
});
```

### Task 2.7: Update tool schema registration

**File**: `src/schema/toolSchemas.ts` (if exists, otherwise in tool registration)  
**Acceptance**: FR-005, FR-006

Update the MCP tool schema to include the new parameters. Location depends on where tool schemas are defined in the codebase.

---

## Implementation Order

| Order | Task | Files | Dependency | Est. Time |
|-------|------|-------|------------|-----------|
| 1 | Task 2.1 | extraction.ts | None | 15 min |
| 2 | Task 2.5 | extraction.test.ts | Task 2.1 | 15 min |
| 3 | Task 2.3 | tools.ts (types) | None | 5 min |
| 4 | Task 2.2 | puppeteer.ts | Task 2.1 | 20 min |
| 5 | Task 2.6 | chat-redirect.test.ts | Task 2.2 | 20 min |
| 6 | Task 2.4 | chatPerplexity.ts | Tasks 2.1-2.3 | 20 min |
| 7 | Task 2.7 | toolSchemas.ts | Task 2.3 | 10 min |

**Total Estimated Time**: ~1.75 hours

---

## Verification Checklist

- [ ] `pnpm test` passes all unit tests
- [ ] `pnpm lint` shows no errors
- [ ] `pnpm build` compiles without errors
- [ ] Manual test: Provide valid chat URL → opens existing chat
- [ ] Manual test: Provide raw chat ID → constructs URL and opens chat
- [ ] Manual test: Invalid URL → returns clear error message
- [ ] Manual test: Expired/deleted chat → returns 404 error message
- [ ] SC-001: Chat opens within 5 seconds (excluding network)
- [ ] SC-005: No messages re-typed when opening existing chat
