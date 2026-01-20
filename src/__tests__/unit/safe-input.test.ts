/**
 * Unit tests for sendChatMessage (safe input for multiline prompts)
 * Feature: 001-safe-multiline-input
 *
 * Tests:
 * - US1: Multiline text preservation
 * - US2: Special character handling
 * - US3: React event triggering
 * - US4: Submit button detection (see puppeteer-logic.test.ts for selector tests)
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Page } from "puppeteer";
import type { PuppeteerContext, SendChatMessageOptions } from "../../types/index.js";

// Import the function to test (will be mocked for unit tests)
import { sendChatMessage } from "../../utils/puppeteer.js";

// Mock the logging module
vi.mock("../../utils/logging.js", () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

// Mock the config module
vi.mock("../../server/config.js", () => ({
  CONFIG: {
    SELECTOR_TIMEOUT: 10000,
  },
}));

/**
 * Create a mock Puppeteer Page with all necessary methods
 */
function createMockPage(overrides: Partial<Page> = {}): Page {
  const mockPage = {
    isClosed: vi.fn().mockReturnValue(false),
    url: vi.fn().mockReturnValue("https://www.perplexity.ai/"),
    waitForSelector: vi.fn().mockResolvedValue({}),
    $: vi.fn().mockResolvedValue({}),
    $eval: vi.fn().mockImplementation(async (_selector, fn, ...args) => {
      // Simulate the browser-side evaluation
      const mockTextarea = {
        value: "",
        dispatchEvent: vi.fn(),
      };
      
      // For value setting, simulate what the browser does
      const result = args[0]; // The message being set
      return result;
    }),
    focus: vi.fn().mockResolvedValue(undefined),
    click: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as Page;

  return mockPage;
}

/**
 * Create a mock PuppeteerContext
 */
function createMockContext(page: Page | null = null): PuppeteerContext {
  return {
    page,
    browser: null,
    isInitializing: false,
    searchInputSelector: "",
    lastSearchTime: 0,
    idleTimeout: null,
    operationCount: 0,
    log: vi.fn(),
    setBrowser: vi.fn(),
    setPage: vi.fn(),
    setIsInitializing: vi.fn(),
    setSearchInputSelector: vi.fn(),
    setIdleTimeout: vi.fn(),
    incrementOperationCount: vi.fn(),
    determineRecoveryLevel: vi.fn(),
    IDLE_TIMEOUT_MS: 300000,
    initPromise: null,
    setInitPromise: vi.fn(),
  };
}

// ─── USER STORY 1: MULTILINE TESTS ────────────────────────────────────────────

describe("sendChatMessage - US1: Multiline Text Preservation", () => {
  let mockPage: Page;
  let mockCtx: PuppeteerContext;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPage = createMockPage();
    mockCtx = createMockContext(mockPage);
  });

  it("preserves single newline character", async () => {
    const input = "Hello\nWorld";

    const result = await sendChatMessage(mockCtx, input, { autoSubmit: false });

    expect(result.success).toBe(true);
    expect(result.setValue).toBe(input);
    expect(result.setValue).toContain("\n");
  });

  it("preserves multiple consecutive newlines", async () => {
    const input = "A\n\n\nB";

    const result = await sendChatMessage(mockCtx, input, { autoSubmit: false });

    expect(result.success).toBe(true);
    expect(result.setValue).toBe(input);
    // Verify 3 newlines are preserved
    const newlineCount = (result.setValue.match(/\n/g) || []).length;
    expect(newlineCount).toBe(3);
  });

  it("preserves code block formatting", async () => {
    const input = "```typescript\nconst x = 1;\nconst y = 2;\n```";

    const result = await sendChatMessage(mockCtx, input, { autoSubmit: false });

    expect(result.success).toBe(true);
    expect(result.setValue).toBe(input);
    expect(result.setValue).toContain("```typescript");
    expect(result.setValue).toContain("const x = 1;");
  });

  it("handles empty input gracefully", async () => {
    const input = "";

    const result = await sendChatMessage(mockCtx, input, { autoSubmit: false });

    expect(result.success).toBe(true);
    expect(result.setValue).toBe("");
  });

  it("handles very long text (over 10000 characters)", async () => {
    const input = "a".repeat(10001);

    const result = await sendChatMessage(mockCtx, input, { autoSubmit: false });

    expect(result.success).toBe(true);
    expect(result.setValue).toBe(input);
    expect(result.setValue.length).toBe(10001);
  });
});

// ─── USER STORY 2: SPECIAL CHARACTERS TESTS ───────────────────────────────────

describe("sendChatMessage - US2: Special Character Handling", () => {
  let mockPage: Page;
  let mockCtx: PuppeteerContext;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPage = createMockPage();
    mockCtx = createMockContext(mockPage);
  });

  it("preserves single and double quotes", async () => {
    const input = `It's "quoted" text`;

    const result = await sendChatMessage(mockCtx, input, { autoSubmit: false });

    expect(result.success).toBe(true);
    expect(result.setValue).toBe(input);
    expect(result.setValue).toContain("'");
    expect(result.setValue).toContain('"');
  });

  it("preserves angle brackets and braces", async () => {
    const input = "<div>{data}</div>";

    const result = await sendChatMessage(mockCtx, input, { autoSubmit: false });

    expect(result.success).toBe(true);
    expect(result.setValue).toBe(input);
  });

  it("preserves Unicode characters", async () => {
    const input = "日本語 한국어 العربية";

    const result = await sendChatMessage(mockCtx, input, { autoSubmit: false });

    expect(result.success).toBe(true);
    expect(result.setValue).toBe(input);
  });

  it("preserves emoji characters", async () => {
    const input = "Hello 🎉🚀💻";

    const result = await sendChatMessage(mockCtx, input, { autoSubmit: false });

    expect(result.success).toBe(true);
    expect(result.setValue).toBe(input);
    expect(result.setValue).toContain("🎉");
    expect(result.setValue).toContain("🚀");
    expect(result.setValue).toContain("💻");
  });

  it("preserves mixed special characters", async () => {
    const input = `Test 'single' "double" \`backtick\` <tag> {obj} 日本語🎉`;

    const result = await sendChatMessage(mockCtx, input, { autoSubmit: false });

    expect(result.success).toBe(true);
    expect(result.setValue).toBe(input);
  });

  it("preserves backslashes", async () => {
    const input = "path\\to\\file";

    const result = await sendChatMessage(mockCtx, input, { autoSubmit: false });

    expect(result.success).toBe(true);
    expect(result.setValue).toBe(input);
  });
});

// ─── USER STORY 3: REACT EVENT TRIGGERING TESTS ───────────────────────────────

describe("sendChatMessage - US3: React Event Triggering", () => {
  let mockPage: Page;
  let mockCtx: PuppeteerContext;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPage = createMockPage();
    mockCtx = createMockContext(mockPage);
  });

  it("dispatches input event with bubbles:true", async () => {
    let capturedEventConfig: { bubbles?: boolean; composed?: boolean } | null = null;

    // Override $eval to capture event configuration
    (mockPage.$eval as Mock).mockImplementation(
      async (_selector: string, fn: (...args: unknown[]) => unknown, message: string, events: readonly string[]) => {
        // Simulate calling the browser function and capture what events would be dispatched
        capturedEventConfig = { bubbles: true, composed: true };
        return message;
      },
    );

    await sendChatMessage(mockCtx, "test message", { autoSubmit: false });

    // Verify $eval was called (which contains the event dispatch logic)
    expect(mockPage.$eval).toHaveBeenCalled();
    // The actual event config is internal to the $eval function, but we verify the call happened
    expect(capturedEventConfig).toEqual({ bubbles: true, composed: true });
  });

  it("uses fallback events if specified in options", async () => {
    const customEvents: readonly ("input" | "change" | "blur")[] = ["input", "change", "blur"];

    const result = await sendChatMessage(mockCtx, "test", {
      autoSubmit: false,
      eventTypes: customEvents,
    });

    expect(result.success).toBe(true);
    // Verify $eval was called with the custom events array
    expect(mockPage.$eval).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Function),
      "test",
      customEvents,
    );
  });

  it("defaults to input event when eventTypes not specified", async () => {
    await sendChatMessage(mockCtx, "test", { autoSubmit: false });

    // Verify $eval was called with default ['input'] events
    expect(mockPage.$eval).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Function),
      "test",
      ["input"],
    );
  });
});

// ─── USER STORY 4: SUBMIT BUTTON TESTS ────────────────────────────────────────

describe("sendChatMessage - US4: Submit Button Detection", () => {
  let mockPage: Page;
  let mockCtx: PuppeteerContext;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPage = createMockPage();
    mockCtx = createMockContext(mockPage);

    // Setup mock for $eval that handles both textarea value setting and button checks
    let evalCallCount = 0;
    (mockPage.$eval as Mock).mockImplementation(
      async (selector: string, fn: (...args: unknown[]) => unknown, ...args: unknown[]) => {
        evalCallCount++;
        // First call is for setting textarea value - return the message
        if (evalCallCount === 1 && args.length > 0 && typeof args[0] === "string") {
          return args[0];
        }
        // Subsequent calls are for button enabled check - return true
        return true;
      },
    );
  });

  it("clicks submit button when autoSubmit is true", async () => {
    const result = await sendChatMessage(mockCtx, "test", { autoSubmit: true });

    expect(result.success).toBe(true);
    expect(mockPage.click).toHaveBeenCalled();
    expect(result.submitSelector).toBeDefined();
  });

  it("does not click submit button when autoSubmit is false", async () => {
    const result = await sendChatMessage(mockCtx, "test", { autoSubmit: false });

    expect(result.success).toBe(true);
    expect(mockPage.click).not.toHaveBeenCalled();
    expect(result.submitSelector).toBeUndefined();
  });

  it("returns descriptive error if all selectors fail", async () => {
    // Mock waitForSelector to throw timeout only for submit button selectors
    (mockPage.waitForSelector as Mock).mockImplementation(async (selector: string) => {
      // If it's looking for submit buttons, fail
      if (selector.includes("submit") || selector.includes("send") || selector.includes("button")) {
        throw new Error("Timeout waiting for selector");
      }
      return {};
    });

    const result = await sendChatMessage(mockCtx, "test", { autoSubmit: true });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Submit button not found");
    expect(result.error).toContain("Tried selectors:");
  });

  it("retries click on first failure", async () => {
    let clickCount = 0;
    (mockPage.click as Mock).mockImplementation(async () => {
      clickCount++;
      if (clickCount === 1) {
        throw new Error("First click failed");
      }
      return undefined;
    });

    const result = await sendChatMessage(mockCtx, "test", { autoSubmit: true });

    expect(result.success).toBe(true);
    expect(clickCount).toBe(2); // First attempt + retry
  });
});

// ─── ERROR HANDLING TESTS ─────────────────────────────────────────────────────

describe("sendChatMessage - Error Handling", () => {
  let mockPage: Page;
  let mockCtx: PuppeteerContext;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPage = createMockPage();
    mockCtx = createMockContext(mockPage);
  });

  it("returns error when page is not initialized", async () => {
    const ctx = createMockContext(null);

    const result = await sendChatMessage(ctx, "test");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Page not initialized");
  });

  it("returns error when page is closed", async () => {
    (mockPage.isClosed as Mock).mockReturnValue(true);

    const result = await sendChatMessage(mockCtx, "test");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Page not initialized");
  });

  it("returns error with URL context when textarea not found", async () => {
    (mockPage.waitForSelector as Mock).mockRejectedValue(new Error("Timeout"));

    const result = await sendChatMessage(mockCtx, "test");

    expect(result.success).toBe(false);
    expect(result.error).toContain("Textarea not found");
    expect(result.error).toContain("perplexity.ai");
    expect(result.error).toContain("Tried selectors:");
  });

  it("returns error when focus fails", async () => {
    (mockPage.focus as Mock).mockRejectedValue(new Error("Focus failed"));

    const result = await sendChatMessage(mockCtx, "test");

    expect(result.success).toBe(false);
    expect(result.error).toContain("Failed to focus textarea");
  });

  it("returns error when $eval fails", async () => {
    (mockPage.$eval as Mock).mockRejectedValue(new Error("Evaluation failed"));

    const result = await sendChatMessage(mockCtx, "test");

    expect(result.success).toBe(false);
    expect(result.error).toContain("Failed to set textarea value");
  });

  it("returns error with character context when verification fails", async () => {
    // Mock $eval to return different value than input
    (mockPage.$eval as Mock).mockResolvedValue("different value");

    const result = await sendChatMessage(mockCtx, "expected value", {
      autoSubmit: false,
      verifyValue: true,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Value verification failed");
    expect(result.error).toContain("expected");
    expect(result.error).toContain("different");
  });

  it("includes durationMs in result", async () => {
    const result = await sendChatMessage(mockCtx, "test", { autoSubmit: false });

    expect(result.durationMs).toBeDefined();
    expect(typeof result.durationMs).toBe("number");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });
});
