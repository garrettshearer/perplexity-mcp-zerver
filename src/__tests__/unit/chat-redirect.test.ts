import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HTTPResponse, Page } from "puppeteer";
import type { PuppeteerContext } from "../../types/browser.js";

// Mock external dependencies
vi.mock("../../utils/puppeteer-logic.js", () => ({
  getSearchInputSelectors: vi.fn().mockReturnValue([
    'textarea[placeholder*="Ask"]',
    'textarea[placeholder*="Search"]',
    "textarea.w-full",
    'textarea[rows="1"]',
    '[role="textbox"]',
    "textarea",
  ]),
}));

vi.mock("../../server/config.js", () => ({
  CONFIG: {
    TIMEOUT_PROFILES: {
      navigation: 30000,
    },
    SELECTOR_TIMEOUT: 10000,
  },
}));

// Helper to create mock page
function createMockPage(overrides: Partial<Page> = {}): Partial<Page> {
  return {
    goto: vi.fn(),
    url: vi.fn().mockReturnValue("https://www.perplexity.ai/search/test-chat-id"),
    waitForSelector: vi.fn().mockResolvedValue({}),
    isClosed: vi.fn().mockReturnValue(false),
    ...overrides,
  };
}

// Helper to create mock context
function createMockContext(page: Partial<Page> | null = null): PuppeteerContext {
  return {
    browser: null,
    page: page as Page | null,
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
    incrementOperationCount: vi.fn().mockReturnValue(1),
    determineRecoveryLevel: vi.fn().mockReturnValue(1),
    IDLE_TIMEOUT_MS: 300000,
    initPromise: null,
    setInitPromise: vi.fn(),
  };
}

// Helper to create mock HTTP response
function createMockResponse(status: number): HTTPResponse {
  return {
    status: vi.fn().mockReturnValue(status),
    ok: vi.fn().mockReturnValue(status >= 200 && status < 300),
  } as unknown as HTTPResponse;
}

describe("openPerplexityChat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should navigate to correct URL with 30s timeout", async () => {
    const { openPerplexityChat } = await import("../../utils/puppeteer.js");

    const mockResponse = createMockResponse(200);
    const mockPage = createMockPage({
      goto: vi.fn().mockResolvedValue(mockResponse),
    });
    const ctx = createMockContext(mockPage);

    await openPerplexityChat(ctx, "test-chat-id");

    expect(mockPage.goto).toHaveBeenCalledWith(
      "https://www.perplexity.ai/search/test-chat-id",
      expect.objectContaining({
        waitUntil: "domcontentloaded",
        timeout: 30000,
      }),
    );
  });

  it("should throw 'Chat not found' error on 404 response", async () => {
    const { openPerplexityChat } = await import("../../utils/puppeteer.js");

    const mockResponse = createMockResponse(404);
    const mockPage = createMockPage({
      goto: vi.fn().mockResolvedValue(mockResponse),
    });
    const ctx = createMockContext(mockPage);

    await expect(openPerplexityChat(ctx, "nonexistent-chat")).rejects.toThrow(
      "Chat not found",
    );
  });

  it("should throw auth error on redirect away from Perplexity", async () => {
    const { openPerplexityChat } = await import("../../utils/puppeteer.js");

    const mockResponse = createMockResponse(200);
    const mockPage = createMockPage({
      goto: vi.fn().mockResolvedValue(mockResponse),
      url: vi.fn().mockReturnValue("https://login.example.com/auth"),
    });
    const ctx = createMockContext(mockPage);

    await expect(openPerplexityChat(ctx, "test-chat-id")).rejects.toThrow(
      "Authentication required",
    );
  });

  it("should throw timeout error if textarea not found", async () => {
    const { openPerplexityChat } = await import("../../utils/puppeteer.js");

    const mockResponse = createMockResponse(200);
    const mockPage = createMockPage({
      goto: vi.fn().mockResolvedValue(mockResponse),
      waitForSelector: vi.fn().mockRejectedValue(new Error("Waiting for selector timed out")),
    });
    const ctx = createMockContext(mockPage);

    await expect(openPerplexityChat(ctx, "test-chat-id")).rejects.toThrow(
      "Chat page loaded but input area not found",
    );
  });

  it("should throw error if page not initialized", async () => {
    const { openPerplexityChat } = await import("../../utils/puppeteer.js");

    const ctx = createMockContext(null);

    await expect(openPerplexityChat(ctx, "test-chat-id")).rejects.toThrow(
      "Page not initialized",
    );
  });

  it("should throw error if page is closed", async () => {
    const { openPerplexityChat } = await import("../../utils/puppeteer.js");

    const mockPage = createMockPage({
      isClosed: vi.fn().mockReturnValue(true),
    });
    const ctx = createMockContext(mockPage);

    await expect(openPerplexityChat(ctx, "test-chat-id")).rejects.toThrow(
      "Page not initialized",
    );
  });

  it("should log navigation attempt", async () => {
    const { openPerplexityChat } = await import("../../utils/puppeteer.js");

    const mockResponse = createMockResponse(200);
    const mockPage = createMockPage({
      goto: vi.fn().mockResolvedValue(mockResponse),
    });
    const ctx = createMockContext(mockPage);

    await openPerplexityChat(ctx, "test-chat-id");

    expect(ctx.log).toHaveBeenCalledWith(
      "info",
      expect.stringContaining("Navigating to existing chat"),
    );
  });

  it("should handle other HTTP errors (500, etc.)", async () => {
    const { openPerplexityChat } = await import("../../utils/puppeteer.js");

    const mockResponse = createMockResponse(500);
    const mockPage = createMockPage({
      goto: vi.fn().mockResolvedValue(mockResponse),
    });
    const ctx = createMockContext(mockPage);

    await expect(openPerplexityChat(ctx, "test-chat-id")).rejects.toThrow(
      "Failed to load chat",
    );
  });
});
