import { beforeEach, describe, expect, it, vi } from "vitest";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { setupToolHandlers, createToolHandlersRegistry } from "../toolHandlerSetup.js";
import type { ToolHandlersRegistry } from "../../types/index.js";

describe("Tool Handler Setup", () => {
  let mockServer: any;
  let mockToolHandlers: ToolHandlersRegistry;

  beforeEach(() => {
    // Mock Server
    mockServer = {
      setRequestHandler: vi.fn(),
    };

    // Mock Tool Handlers
    mockToolHandlers = {
      chatPerplexity: vi.fn().mockResolvedValue("chat response"),
      search: vi.fn().mockResolvedValue("search response"),
      extractUrlContent: vi.fn().mockResolvedValue("extract response"),
      getDocumentation: vi.fn().mockResolvedValue("doc response"),
      findApis: vi.fn().mockResolvedValue("api response"),
      checkDeprecatedCode: vi.fn().mockResolvedValue("deprecated response"),
    } as ToolHandlersRegistry;
  });

  describe("setupToolHandlers", () => {
    it("should register ListTools handler", () => {
      setupToolHandlers(mockServer, mockToolHandlers);

      expect(mockServer.setRequestHandler).toHaveBeenCalledWith(
        ListToolsRequestSchema,
        expect.any(Function),
      );
    });

    it("should register CallTool handler", () => {
      setupToolHandlers(mockServer, mockToolHandlers);

      expect(mockServer.setRequestHandler).toHaveBeenCalledWith(
        CallToolRequestSchema,
        expect.any(Function),
      );
    });

    it("should call the appropriate tool handler for known tools", async () => {
      setupToolHandlers(mockServer, mockToolHandlers);

      // Get the CallTool handler function (second call)
      const callToolHandler = mockServer.setRequestHandler.mock.calls[1][1];

      const mockRequest = {
        params: {
          name: "chatPerplexity",
          arguments: { message: "test" },
        },
      };

      const response = await callToolHandler(mockRequest);
      expect(mockToolHandlers["chatPerplexity"]).toHaveBeenCalledWith({ message: "test" });
      expect(response).toHaveProperty("content");
    });
  });

  describe("createToolHandlersRegistry", () => {
    it("should create a tool handlers registry with provided handlers", () => {
      const registry = createToolHandlersRegistry(mockToolHandlers);

      expect(registry).toBeDefined();
      expect(registry["chatPerplexity"]).toBe(mockToolHandlers["chatPerplexity"]);
      expect(registry["search"]).toBe(mockToolHandlers["search"]);
      expect(registry["extractUrlContent"]).toBe(mockToolHandlers["extractUrlContent"]);
      expect(registry["getDocumentation"]).toBe(mockToolHandlers["getDocumentation"]);
      expect(registry["findApis"]).toBe(mockToolHandlers["findApis"]);
      expect(registry["checkDeprecatedCode"]).toBe(mockToolHandlers["checkDeprecatedCode"]);
    });
  });

  // T007: Unit tests for AsyncGenerator detection and accumulation
  describe("AsyncGenerator handling", () => {
    /**
     * Helper to create an AsyncGenerator for testing
     */
    async function* createMockAsyncGenerator(chunks: string[]): AsyncGenerator<string, void, unknown> {
      for (const chunk of chunks) {
        yield chunk;
      }
    }

    it("should accumulate AsyncGenerator chunks into single string response", async () => {
      // Create a tool handler that returns an AsyncGenerator
      const streamingHandler = vi.fn().mockImplementation(() => 
        createMockAsyncGenerator(["Hello ", "World", "!"])
      );
      
      const streamingToolHandlers: ToolHandlersRegistry = {
        ...mockToolHandlers,
        search: streamingHandler,
      };

      setupToolHandlers(mockServer, streamingToolHandlers);

      // Get the CallTool handler function (second call)
      const callToolHandler = mockServer.setRequestHandler.mock.calls[1][1];

      const mockRequest = {
        params: {
          name: "search",
          arguments: { query: "test streaming" },
        },
      };

      const response = await callToolHandler(mockRequest);
      
      // Should receive accumulated text, not [object AsyncGenerator]
      expect(response.content[0].text).toBe("Hello World!");
    });

    it("should handle empty AsyncGenerator", async () => {
      const emptyStreamingHandler = vi.fn().mockImplementation(() => 
        createMockAsyncGenerator([])
      );
      
      const streamingToolHandlers: ToolHandlersRegistry = {
        ...mockToolHandlers,
        search: emptyStreamingHandler,
      };

      setupToolHandlers(mockServer, streamingToolHandlers);
      const callToolHandler = mockServer.setRequestHandler.mock.calls[1][1];

      const mockRequest = {
        params: {
          name: "search",
          arguments: { query: "empty stream" },
        },
      };

      const response = await callToolHandler(mockRequest);
      expect(response.content[0].text).toBe("");
    });

    it("should pass through non-generator results unchanged", async () => {
      // Regular string result (not AsyncGenerator)
      const regularHandler = vi.fn().mockResolvedValue("regular response");
      
      const regularToolHandlers: ToolHandlersRegistry = {
        ...mockToolHandlers,
        search: regularHandler,
      };

      setupToolHandlers(mockServer, regularToolHandlers);
      const callToolHandler = mockServer.setRequestHandler.mock.calls[1][1];

      const mockRequest = {
        params: {
          name: "search",
          arguments: { query: "regular query" },
        },
      };

      const response = await callToolHandler(mockRequest);
      expect(response.content[0].text).toBe("regular response");
    });
  });
});
