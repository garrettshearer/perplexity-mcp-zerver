import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PuppeteerContext } from "../../types/browser.js";
import type { PageContentResult } from "../../types/browser.js";
import type { ChatMessage } from "../../types/database.js";

// Mock Puppeteer
vi.mock("puppeteer", () => ({
  default: {
    launch: vi.fn(),
  },
}));

// Mock Mozilla Readability
vi.mock("@mozilla/readability", () => ({
  Readability: vi.fn(),
}));

// Mock JSDOM
vi.mock("jsdom", () => ({
  JSDOM: vi.fn(),
}));

// Mock logging
vi.mock("../../utils/logging.js", () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

// Mock database utilities
const mockGetChatHistory = vi.fn();
const mockSaveChatMessage = vi.fn();
vi.mock("../../utils/db.js", () => ({
  initializeDatabase: vi.fn(),
  getChatHistory: () => mockGetChatHistory(),
  saveChatMessage: () => mockSaveChatMessage(),
}));

// Mock extraction utilities
vi.mock("../../utils/extraction.js", () => ({
  fetchSinglePageContent: vi.fn(),
  recursiveFetch: vi.fn(),
  extractSameDomainLinks: vi.fn(),
  extractChatId: vi.fn().mockImplementation((input: string) => {
    // Simple passthrough for testing - real validation done in extraction.test.ts
    if (!input || typeof input !== "string" || input.trim().length < 8) return null;
    return input.trim();
  }),
}));

// Mock puppeteer utilities
vi.mock("../../utils/puppeteer.js", () => ({
  openPerplexityChat: vi.fn().mockResolvedValue(undefined),
  openPerplexitySpace: vi.fn().mockResolvedValue(undefined),
  switchModel: vi.fn().mockResolvedValue({ success: true, selectedModel: "Default", wasAlreadySelected: false }),
  setResearchMode: vi.fn().mockResolvedValue({ success: true, mode: "search", wasAlreadyActive: false }),
}));

// Mock fetch utilities
vi.mock("../../utils/fetch.js", () => ({
  fetchWithTimeout: vi.fn(),
  fetchSimpleContent: vi.fn(),
}));

// Mock puppeteer-logic utilities
vi.mock("../../utils/puppeteer-logic.js", () => ({
  isValidUrlForBrowser: vi.fn(),
}));

// Create a proper mock context with all required properties
const mockCtx: PuppeteerContext = {
  browser: null,
  page: null,
  isInitializing: false,
  searchInputSelector: 'textarea[placeholder*="Ask"]',
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

describe("Tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("chatPerplexity", () => {
    it("should handle basic chat functionality with new chat_id", async () => {
      const { default: chatPerplexity } = await import("../../tools/chatPerplexity.js");

      mockGetChatHistory.mockReturnValue([]);
      const mockPerformSearch = vi.fn().mockResolvedValue("Mock response");

      const args = { message: "Hello, world!" };
      const result = await chatPerplexity(
        args,
        mockCtx,
        mockPerformSearch,
        mockGetChatHistory,
        mockSaveChatMessage,
      );

      expect(mockGetChatHistory).toHaveBeenCalled();
      expect(mockSaveChatMessage).toHaveBeenCalled();
      expect(mockPerformSearch).toHaveBeenCalledWith(
        expect.stringContaining("Hello, world!"),
        mockCtx,
      );
      expect(result).toBe("Mock response");
    });

    it("should handle chat with existing chat_id by opening URL (not replaying history)", async () => {
      const { default: chatPerplexity } = await import("../../tools/chatPerplexity.js");
      const { openPerplexityChat } = await import("../../utils/puppeteer.js");

      mockGetChatHistory.mockReturnValue([
        { role: "user", content: "Previous message" } as ChatMessage,
        { role: "assistant", content: "Previous response" } as ChatMessage,
      ]);
      const mockPerformSearch = vi.fn().mockResolvedValue("New response");

      const args = { message: "New message", chat_id: "test-chat-id" };
      const result = await chatPerplexity(
        args,
        mockCtx,
        mockPerformSearch,
        mockGetChatHistory,
        mockSaveChatMessage,
      );

      // For existing chats, should open URL (not replay history)
      expect(openPerplexityChat).toHaveBeenCalledWith(mockCtx, "test-chat-id");
      // Message should be sent directly without history prefix
      expect(mockPerformSearch).toHaveBeenCalledWith("New message", mockCtx);
      expect(result).toBe("New response");
    });

    it("should handle empty message gracefully", async () => {
      const { default: chatPerplexity } = await import("../../tools/chatPerplexity.js");

      mockGetChatHistory.mockReturnValue([]);
      const mockPerformSearch = vi.fn().mockResolvedValue("Response to empty message");

      const args = { message: "" };
      const result = await chatPerplexity(
        args,
        mockCtx,
        mockPerformSearch,
        mockGetChatHistory,
        mockSaveChatMessage,
      );

      expect(mockPerformSearch).toHaveBeenCalled();
      expect(result).toBe("Response to empty message");
    });
  });

  describe("search", () => {
    it("should handle normal detail level search", async () => {
      const { default: search } = await import("../../tools/search.js");

      const mockPerformSearch = vi.fn().mockResolvedValue("Normal search result");

      const args = { query: "test query", detail_level: "normal" as const };
      const result = await search(args, mockCtx, mockPerformSearch);

      expect(mockPerformSearch).toHaveBeenCalledWith(
        expect.stringContaining("Provide a clear, balanced answer to: test query"),
        mockCtx,
      );
      expect(result).toBe("Normal search result");
    });

    it("should handle brief detail level search", async () => {
      const { default: search } = await import("../../tools/search.js");

      const mockPerformSearch = vi.fn().mockResolvedValue("Brief search result");

      const args = { query: "test query", detail_level: "brief" as const };
      const result = await search(args, mockCtx, mockPerformSearch);

      expect(mockPerformSearch).toHaveBeenCalledWith(
        expect.stringContaining("Provide a brief, concise answer to: test query"),
        mockCtx,
      );
      expect(result).toBe("Brief search result");
    });

    it("should handle detailed detail level search", async () => {
      const { default: search } = await import("../../tools/search.js");

      const mockPerformSearch = vi.fn().mockResolvedValue("Detailed search result");

      const args = { query: "test query", detail_level: "detailed" as const };
      const result = await search(args, mockCtx, mockPerformSearch);

      expect(mockPerformSearch).toHaveBeenCalledWith(
        expect.stringContaining("Provide a comprehensive, detailed analysis of: test query"),
        mockCtx,
      );
      expect(result).toBe("Detailed search result");
    });

    it("should handle streaming search", async () => {
      const { default: search } = await import("../../tools/search.js");

      const mockPerformSearch = vi.fn().mockResolvedValue("Streaming search result");

      const args = { query: "test query", stream: true };
      const result = await search(args, mockCtx, mockPerformSearch);

      // Should return a generator for streaming
      expect(typeof result).toBe("object");
      expect(result).toHaveProperty("next");
    });

    it("should handle search with default parameters", async () => {
      const { default: search } = await import("../../tools/search.js");

      const mockPerformSearch = vi.fn().mockResolvedValue("Default search result");

      const args = { query: "test query" };
      const result = await search(args, mockCtx, mockPerformSearch);

      expect(mockPerformSearch).toHaveBeenCalledWith(
        expect.stringContaining("Provide a clear, balanced answer to: test query"),
        mockCtx,
      );
      expect(result).toBe("Default search result");
    });
  });

  describe("extractUrlContent", () => {
    it("should handle single page extraction", async () => {
      const { default: extractUrlContent } = await import("../../tools/extractUrlContent.js");

      const mockResult: PageContentResult = {
        url: "https://example.com",
        title: "Example Page",
        textContent: "Example content",
        error: null,
      };

      const { fetchSinglePageContent } = await import("../../utils/extraction.js");
      vi.mocked(fetchSinglePageContent).mockResolvedValue(mockResult);

      const args = { url: "https://example.com", depth: 1 };
      const result = await extractUrlContent(args, mockCtx);

      // For depth=1, it should return the result directly as JSON
      const parsedResult = JSON.parse(result);
      expect(parsedResult.url).toBe("https://example.com");
      expect(parsedResult.textContent).toBe("Example content");
    });

    it("should handle recursive extraction with depth > 1", async () => {
      const { default: extractUrlContent } = await import("../../tools/extractUrlContent.js");

      const mockResults: PageContentResult[] = [
        {
          url: "https://example.com",
          title: "Example Page",
          textContent: "Example content",
          error: null,
        },
      ];

      const { recursiveFetch } = await import("../../utils/extraction.js");
      vi.mocked(recursiveFetch).mockImplementation(async (_, __, ___, ____, results) => {
        results.push(...mockResults);
      });

      const args = { url: "https://example.com", depth: 2 };
      const result = await extractUrlContent(args, mockCtx);

      const parsedResult = JSON.parse(result);
      expect(parsedResult.explorationDepth).toBe(2);
      expect(parsedResult.pagesExplored).toBe(1);
      expect(parsedResult.rootUrl).toBe("https://example.com");
    });

    it("should handle GitHub URL rewriting", async () => {
      const { default: extractUrlContent } = await import("../../tools/extractUrlContent.js");

      const mockResult: PageContentResult = {
        url: "https://github.com/user/repo",
        title: "GitHub Repository",
        textContent: "Repository content",
        error: null,
      };

      const { fetchSinglePageContent } = await import("../../utils/extraction.js");
      vi.mocked(fetchSinglePageContent).mockResolvedValue(mockResult);

      const args = { url: "https://github.com/user/repo", depth: 1 };
      const result = await extractUrlContent(args, mockCtx);

      // For GitHub URLs with depth=1, it should still return the result directly
      const parsedResult = JSON.parse(result);
      expect(parsedResult.url).toBe("https://github.com/user/repo");
      expect(parsedResult.textContent).toBe("Repository content");
    });

    it("should handle extraction errors gracefully", async () => {
      const { default: extractUrlContent } = await import("../../tools/extractUrlContent.js");

      const { fetchSinglePageContent } = await import("../../utils/extraction.js");
      // Mock fetchSinglePageContent to return an error result, not throw
      vi.mocked(fetchSinglePageContent).mockResolvedValue({
        url: "https://invalid-url.com",
        error: "Network error",
      });

      const args = { url: "https://invalid-url.com", depth: 1 };

      // The function should catch the error and return it in the result, not throw
      const result = await extractUrlContent(args, mockCtx);

      // For depth=1, errors should be returned in the result object
      const parsedResult = JSON.parse(result);
      expect(parsedResult.error).toContain("Network error");
    });

    it("should validate depth parameter boundaries", async () => {
      const { default: extractUrlContent } = await import("../../tools/extractUrlContent.js");

      const mockResult: PageContentResult = {
        url: "https://example.com",
        title: "Example Page",
        textContent: "Example content",
        error: null,
      };

      const { fetchSinglePageContent } = await import("../../utils/extraction.js");
      vi.mocked(fetchSinglePageContent).mockResolvedValue(mockResult);

      // Test depth clamping - should be max 5
      const args = { url: "https://example.com", depth: 10 };
      const result = await extractUrlContent(args, mockCtx);

      // For depth > 1, it should return the formatted result object
      const parsedResult = JSON.parse(result);
      expect(parsedResult.explorationDepth).toBe(5); // Max depth should be 5
    });
  });

  describe("getDocumentation", () => {
    it("should handle basic documentation query", async () => {
      const { default: getDocumentation } = await import("../../tools/getDocumentation.js");

      const mockPerformSearch = vi.fn().mockResolvedValue("Documentation result");

      const args = { query: "React hooks" };
      const result = await getDocumentation(args, mockCtx, mockPerformSearch);

      expect(mockPerformSearch).toHaveBeenCalledWith(
        expect.stringContaining(
          "Provide comprehensive documentation and usage examples for React hooks",
        ),
        mockCtx,
      );
      expect(result).toBe("Documentation result");
    });

    it("should handle documentation query with context", async () => {
      const { default: getDocumentation } = await import("../../tools/getDocumentation.js");

      const mockPerformSearch = vi.fn().mockResolvedValue("Documentation with context result");

      const args = { query: "React hooks", context: "focus on performance optimization" };
      const result = await getDocumentation(args, mockCtx, mockPerformSearch);

      expect(mockPerformSearch).toHaveBeenCalledWith(
        expect.stringContaining("Focus on: focus on performance optimization"),
        mockCtx,
      );
      expect(result).toBe("Documentation with context result");
    });
  });

  describe("findApis", () => {
    it("should handle API discovery query", async () => {
      const { default: findApis } = await import("../../tools/findApis.js");

      const mockPerformSearch = vi.fn().mockResolvedValue("API discovery result");

      const args = { requirement: "image recognition" };
      const result = await findApis(args, mockCtx, mockPerformSearch);

      expect(mockPerformSearch).toHaveBeenCalledWith(
        expect.stringContaining("Find and evaluate APIs that could be used for: image recognition"),
        mockCtx,
      );
      expect(result).toBe("API discovery result");
    });

    it("should handle API discovery with context", async () => {
      const { default: findApis } = await import("../../tools/findApis.js");

      const mockPerformSearch = vi.fn().mockResolvedValue("API discovery with context result");

      const args = { requirement: "payment processing", context: "prefer free tier options" };
      const result = await findApis(args, mockCtx, mockPerformSearch);

      expect(mockPerformSearch).toHaveBeenCalledWith(
        expect.stringContaining("Context: prefer free tier options"),
        mockCtx,
      );
      expect(result).toBe("API discovery with context result");
    });
  });

  describe("checkDeprecatedCode", () => {
    it("should handle deprecated code checking", async () => {
      const { default: checkDeprecatedCode } = await import("../../tools/checkDeprecatedCode.js");

      const mockPerformSearch = vi.fn().mockResolvedValue("Deprecation check result");

      const args = { code: "componentWillMount()" };
      const result = await checkDeprecatedCode(args, mockCtx, mockPerformSearch);

      expect(mockPerformSearch).toHaveBeenCalledWith(
        expect.stringContaining("componentWillMount()"),
        mockCtx,
      );
      expect(result).toBe("Deprecation check result");
    });

    it("should handle deprecated code checking with technology context", async () => {
      const { default: checkDeprecatedCode } = await import("../../tools/checkDeprecatedCode.js");

      const mockPerformSearch = vi
        .fn()
        .mockResolvedValue("Deprecation check with tech context result");

      const args = { code: "var instead of let/const", technology: "React 16" };
      const result = await checkDeprecatedCode(args, mockCtx, mockPerformSearch);

      expect(mockPerformSearch).toHaveBeenCalledWith(
        expect.stringContaining("var instead of let/const"),
        mockCtx,
      );
      expect(mockPerformSearch).toHaveBeenCalledWith(expect.stringContaining("React 16"), mockCtx);
      expect(result).toBe("Deprecation check with tech context result");
    });
  });

  // Phase 4: User Story 2 - Search with space_id
  describe("search with space_id", () => {
    // T030: search with space_id calls openPerplexitySpace before performSearch
    it("should call openPerplexitySpace when space_id is provided", async () => {
      const { default: search } = await import("../../tools/search.js");
      const { openPerplexitySpace } = await import("../../utils/puppeteer.js");

      const mockPerformSearch = vi.fn().mockResolvedValue("Search result in space");

      const args = { query: "test query", space_id: "my-test-space" };
      const result = await search(args, mockCtx, mockPerformSearch);

      // Should navigate to space first
      expect(openPerplexitySpace).toHaveBeenCalledWith(mockCtx, "my-test-space");
      // Then perform search
      expect(mockPerformSearch).toHaveBeenCalled();
      expect(result).toBe("Search result in space");
    });

    // T031: search without space_id does NOT call openPerplexitySpace
    it("should NOT call openPerplexitySpace when space_id is not provided", async () => {
      const { default: search } = await import("../../tools/search.js");
      const { openPerplexitySpace } = await import("../../utils/puppeteer.js");
      vi.mocked(openPerplexitySpace).mockClear();

      const mockPerformSearch = vi.fn().mockResolvedValue("Normal search result");

      const args = { query: "test query" };
      const result = await search(args, mockCtx, mockPerformSearch);

      // Should NOT navigate to space
      expect(openPerplexitySpace).not.toHaveBeenCalled();
      expect(mockPerformSearch).toHaveBeenCalled();
      expect(result).toBe("Normal search result");
    });

    // T032: search space navigation error propagates (search not attempted)
    it("should propagate space navigation errors without attempting search", async () => {
      const { default: search } = await import("../../tools/search.js");
      const { openPerplexitySpace } = await import("../../utils/puppeteer.js");
      vi.mocked(openPerplexitySpace).mockRejectedValueOnce(new Error("Space not found: test-space"));

      const mockPerformSearch = vi.fn().mockResolvedValue("Should not reach here");

      const args = { query: "test query", space_id: "test-space" };

      await expect(search(args, mockCtx, mockPerformSearch)).rejects.toThrow("Space not found");
      expect(mockPerformSearch).not.toHaveBeenCalled();
    });
  });

  // Phase 5: User Story 3 - Chat with space_id
  describe("chat with space_id", () => {
    // T038: new chat with space_id calls openPerplexitySpace
    it("should call openPerplexitySpace for new chat when space_id is provided", async () => {
      const { default: chatPerplexity } = await import("../../tools/chatPerplexity.js");
      const { openPerplexitySpace } = await import("../../utils/puppeteer.js");
      vi.mocked(openPerplexitySpace).mockClear();

      mockGetChatHistory.mockReturnValue([]);
      const mockPerformSearch = vi.fn().mockResolvedValue("Chat response in space");

      const args = { message: "Hello in space!", space_id: "my-space" };
      const result = await chatPerplexity(
        args,
        mockCtx,
        mockPerformSearch,
        mockGetChatHistory,
        mockSaveChatMessage,
      );

      // For new chats with space_id, should navigate to space
      expect(openPerplexitySpace).toHaveBeenCalledWith(mockCtx, "my-space");
      expect(mockPerformSearch).toHaveBeenCalled();
      expect(result).toBe("Chat response in space");
    });

    // T039: existing chat with chat_id ignores space_id
    it("should ignore space_id when chat_id is provided", async () => {
      const { default: chatPerplexity } = await import("../../tools/chatPerplexity.js");
      const { openPerplexityChat, openPerplexitySpace } = await import("../../utils/puppeteer.js");
      vi.mocked(openPerplexitySpace).mockClear();
      vi.mocked(openPerplexityChat).mockClear();

      mockGetChatHistory.mockReturnValue([]);
      const mockPerformSearch = vi.fn().mockResolvedValue("Chat response");

      const args = { message: "Hello", chat_id: "existing-chat", space_id: "my-space" };
      const result = await chatPerplexity(
        args,
        mockCtx,
        mockPerformSearch,
        mockGetChatHistory,
        mockSaveChatMessage,
      );

      // Should use chat_id (open chat), NOT space_id
      expect(openPerplexityChat).toHaveBeenCalledWith(mockCtx, "existing-chat");
      expect(openPerplexitySpace).not.toHaveBeenCalled();
      expect(result).toBe("Chat response");
    });

    // T040: existing chat with chat_url ignores space_id
    it("should ignore space_id when chat_url is provided", async () => {
      const { default: chatPerplexity } = await import("../../tools/chatPerplexity.js");
      const { openPerplexityChat, openPerplexitySpace } = await import("../../utils/puppeteer.js");
      vi.mocked(openPerplexitySpace).mockClear();
      vi.mocked(openPerplexityChat).mockClear();

      mockGetChatHistory.mockReturnValue([]);
      const mockPerformSearch = vi.fn().mockResolvedValue("Chat response from URL");

      const args = {
        message: "Hello",
        chat_url: "https://perplexity.ai/search/existing-chat-url",
        space_id: "my-space",
      };
      const result = await chatPerplexity(
        args,
        mockCtx,
        mockPerformSearch,
        mockGetChatHistory,
        mockSaveChatMessage,
      );

      // Should use chat_url (open chat), NOT space_id
      expect(openPerplexityChat).toHaveBeenCalled();
      expect(openPerplexitySpace).not.toHaveBeenCalled();
      expect(result).toBe("Chat response from URL");
    });

    // T041: chat without space_id works as before
    it("should work without space_id (backward compatibility)", async () => {
      const { default: chatPerplexity } = await import("../../tools/chatPerplexity.js");
      const { openPerplexitySpace } = await import("../../utils/puppeteer.js");
      vi.mocked(openPerplexitySpace).mockClear();

      mockGetChatHistory.mockReturnValue([]);
      const mockPerformSearch = vi.fn().mockResolvedValue("Normal chat response");

      const args = { message: "Hello without space!" };
      const result = await chatPerplexity(
        args,
        mockCtx,
        mockPerformSearch,
        mockGetChatHistory,
        mockSaveChatMessage,
      );

      // Should NOT navigate to space
      expect(openPerplexitySpace).not.toHaveBeenCalled();
      expect(mockPerformSearch).toHaveBeenCalled();
      expect(result).toBe("Normal chat response");
    });
  });
});
