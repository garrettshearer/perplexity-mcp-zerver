/**
 * Tests for openPerplexitySpace function
 * Tests space navigation: URL construction, error handling, selector waits
 */
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
    url: vi.fn().mockReturnValue("https://www.perplexity.ai/spaces/test-space-id"),
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

describe("openPerplexitySpace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // T010: throws on null page
  it("should throw error if page is null", async () => {
    const { openPerplexitySpace } = await import("../../utils/puppeteer.js");

    const ctx = createMockContext(null);

    await expect(openPerplexitySpace(ctx, "test-space-id")).rejects.toThrow(
      "Page not initialized",
    );
  });

  // T011: throws on closed page
  it("should throw error if page is closed", async () => {
    const { openPerplexitySpace } = await import("../../utils/puppeteer.js");

    const mockPage = createMockPage({
      isClosed: vi.fn().mockReturnValue(true),
    });
    const ctx = createMockContext(mockPage);

    await expect(openPerplexitySpace(ctx, "test-space-id")).rejects.toThrow(
      "Page not initialized",
    );
  });

  // T012: throws on empty space ID
  it("should throw error on empty space ID", async () => {
    const { openPerplexitySpace } = await import("../../utils/puppeteer.js");

    const mockResponse = createMockResponse(200);
    const mockPage = createMockPage({
      goto: vi.fn().mockResolvedValue(mockResponse),
    });
    const ctx = createMockContext(mockPage);

    await expect(openPerplexitySpace(ctx, "")).rejects.toThrow(
      "Space ID is required",
    );
  });

  // T013: throws on whitespace-only space ID
  it("should throw error on whitespace-only space ID", async () => {
    const { openPerplexitySpace } = await import("../../utils/puppeteer.js");

    const mockResponse = createMockResponse(200);
    const mockPage = createMockPage({
      goto: vi.fn().mockResolvedValue(mockResponse),
    });
    const ctx = createMockContext(mockPage);

    await expect(openPerplexitySpace(ctx, "   ")).rejects.toThrow(
      "Space ID is required",
    );
  });

  // T014: navigates to correct space URL format
  it("should navigate to correct space URL format", async () => {
    const { openPerplexitySpace } = await import("../../utils/puppeteer.js");

    const mockResponse = createMockResponse(200);
    const mockPage = createMockPage({
      goto: vi.fn().mockResolvedValue(mockResponse),
    });
    const ctx = createMockContext(mockPage);

    await openPerplexitySpace(ctx, "test-space-id");

    expect(mockPage.goto).toHaveBeenCalledWith(
      "https://www.perplexity.ai/spaces/test-space-id",
      expect.objectContaining({
        waitUntil: "domcontentloaded",
      }),
    );
  });

  // T015: uses 30s navigation timeout
  it("should use 30s navigation timeout", async () => {
    const { openPerplexitySpace } = await import("../../utils/puppeteer.js");

    const mockResponse = createMockResponse(200);
    const mockPage = createMockPage({
      goto: vi.fn().mockResolvedValue(mockResponse),
    });
    const ctx = createMockContext(mockPage);

    await openPerplexitySpace(ctx, "test-space-id");

    expect(mockPage.goto).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        timeout: 30000,
      }),
    );
  });

  // T016: throws Space not found on 404
  it("should throw 'Space not found' on 404 response", async () => {
    const { openPerplexitySpace } = await import("../../utils/puppeteer.js");

    const mockResponse = createMockResponse(404);
    const mockPage = createMockPage({
      goto: vi.fn().mockResolvedValue(mockResponse),
    });
    const ctx = createMockContext(mockPage);

    await expect(openPerplexitySpace(ctx, "nonexistent-space")).rejects.toThrow(
      "Space not found",
    );
  });

  // T017: throws Authentication required on auth redirect
  it("should throw 'Authentication required' on redirect away from Perplexity", async () => {
    const { openPerplexitySpace } = await import("../../utils/puppeteer.js");

    const mockResponse = createMockResponse(200);
    const mockPage = createMockPage({
      goto: vi.fn().mockResolvedValue(mockResponse),
      url: vi.fn().mockReturnValue("https://login.example.com/auth"),
    });
    const ctx = createMockContext(mockPage);

    await expect(openPerplexitySpace(ctx, "test-space-id")).rejects.toThrow(
      "Authentication required",
    );
  });

  // T018: throws on selector timeout
  it("should throw error if textarea selector times out", async () => {
    const { openPerplexitySpace } = await import("../../utils/puppeteer.js");

    const mockResponse = createMockResponse(200);
    const mockPage = createMockPage({
      goto: vi.fn().mockResolvedValue(mockResponse),
      waitForSelector: vi.fn().mockRejectedValue(new Error("Waiting for selector timed out")),
    });
    const ctx = createMockContext(mockPage);

    await expect(openPerplexitySpace(ctx, "test-space-id")).rejects.toThrow(
      "Space page loaded but input area not found",
    );
  });

  // T019: logs navigation attempt
  it("should log navigation attempt", async () => {
    const { openPerplexitySpace } = await import("../../utils/puppeteer.js");

    const mockResponse = createMockResponse(200);
    const mockPage = createMockPage({
      goto: vi.fn().mockResolvedValue(mockResponse),
    });
    const ctx = createMockContext(mockPage);

    await openPerplexitySpace(ctx, "test-space-id");

    expect(ctx.log).toHaveBeenCalledWith(
      "info",
      expect.stringContaining("Navigating to space"),
    );
  });

  // Additional test: handle other HTTP errors
  it("should handle other HTTP errors (500, etc.)", async () => {
    const { openPerplexitySpace } = await import("../../utils/puppeteer.js");

    const mockResponse = createMockResponse(500);
    const mockPage = createMockPage({
      goto: vi.fn().mockResolvedValue(mockResponse),
    });
    const ctx = createMockContext(mockPage);

    await expect(openPerplexitySpace(ctx, "test-space-id")).rejects.toThrow(
      "Failed to load space",
    );
  });
});

// Phase 6: User Story 4 - Error message quality tests
describe("openPerplexitySpace error messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // T047: 404 error message includes space ID and suggestion
  it("should include space ID and suggestion in 404 error message", async () => {
    const { openPerplexitySpace } = await import("../../utils/puppeteer.js");

    const mockResponse = createMockResponse(404);
    const mockPage = createMockPage({
      goto: vi.fn().mockResolvedValue(mockResponse),
    });
    const ctx = createMockContext(mockPage);

    try {
      await openPerplexitySpace(ctx, "my-test-space");
      expect.fail("Should have thrown an error");
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain("my-test-space");
      expect(message).toMatch(/verify|check|ensure/i);
    }
  });

  // T048: auth error message suggests checking login status
  it("should suggest checking login status in auth error message", async () => {
    const { openPerplexitySpace } = await import("../../utils/puppeteer.js");

    const mockResponse = createMockResponse(200);
    const mockPage = createMockPage({
      goto: vi.fn().mockResolvedValue(mockResponse),
      url: vi.fn().mockReturnValue("https://login.example.com/auth"),
    });
    const ctx = createMockContext(mockPage);

    try {
      await openPerplexitySpace(ctx, "test-space-id");
      expect.fail("Should have thrown an error");
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toMatch(/login|auth|sign/i);
    }
  });

  // T049: timeout error message includes retry suggestion
  it("should include retry suggestion in timeout error message", async () => {
    const { openPerplexitySpace } = await import("../../utils/puppeteer.js");

    const mockResponse = createMockResponse(200);
    const mockPage = createMockPage({
      goto: vi.fn().mockResolvedValue(mockResponse),
      waitForSelector: vi.fn().mockRejectedValue(new Error("Waiting for selector timed out")),
    });
    const ctx = createMockContext(mockPage);

    try {
      await openPerplexitySpace(ctx, "test-space-id");
      expect.fail("Should have thrown an error");
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toMatch(/loaded|try|retry/i);
    }
  });
});
