/**
 * PerplexityServer - Modular, testable architecture
 * Uses dependency injection and focused modules for better testability
 */
import { createRequire } from "node:module";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// Dynamic version from package.json (T016, T017)
const require = createRequire(import.meta.url);
const pkg = require("../../package.json") as { version: string };
import type {
  IBrowserManager,
  IDatabaseManager,
  ISearchEngine,
  ServerDependencies,
} from "../types/index.js";
import { logError, logInfo } from "../utils/logging.js";
import { BrowserManager } from "./modules/BrowserManager.js";
import { DatabaseManager } from "./modules/DatabaseManager.js";
import { SearchEngine } from "./modules/SearchEngine.js";
import { createToolHandlersRegistry, setupToolHandlers } from "./toolHandlerSetup.js";

// Import modular tool implementations
import chatPerplexity from "../tools/chatPerplexity.js";
import extractUrlContent from "../tools/extractUrlContent.js";

export class PerplexityServer {
  private readonly server: Server;
  private readonly browserManager: IBrowserManager;
  private readonly searchEngine: ISearchEngine;
  private readonly databaseManager: IDatabaseManager;

  constructor(dependencies?: ServerDependencies) {
    try {
      // Initialize MCP Server
      this.server = new Server(
        { name: "perplexity-server", version: pkg.version },
        {
          capabilities: {
            tools: {
              listChanged: true,
            },
          },
        },
      );

      // Initialize modules with dependency injection
      this.databaseManager = dependencies?.databaseManager ?? new DatabaseManager();
      this.browserManager = dependencies?.browserManager ?? new BrowserManager();
      this.searchEngine = dependencies?.searchEngine ?? new SearchEngine(this.browserManager);

      // Initialize database
      this.databaseManager.initialize();

      // Setup tool handlers
      this.setupToolHandlers();

      // Setup graceful shutdown (only if not in MCP mode and not in test mode)
      // biome-ignore lint/complexity/useLiteralKeys: Environment variable access
      if (!process.env["MCP_MODE"] && !process.env["VITEST"]) {
        this.setupShutdownHandler();
      }

      logInfo("PerplexityServer initialized successfully");
    } catch (error) {
      logError("Error in PerplexityServer constructor:", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  private setupShutdownHandler(): void {
    process.on("SIGINT", async () => {
      logInfo("SIGINT received, shutting down gracefully...");
      try {
        await this.cleanup();
        await this.server.close();
        process.exit(0);
      } catch (error) {
        logError("Error during shutdown:", {
          error: error instanceof Error ? error.message : String(error),
        });
        process.exit(1);
      }
    });
  }

  private async cleanup(): Promise<void> {
    try {
      await this.browserManager.cleanup();
      this.databaseManager.close();
      logInfo("Server cleanup completed");
    } catch (error) {
      logError("Error during cleanup:", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Tool handler implementations
  // T012: Updated to use SearchResult.url as chat_id
  private async handleChatPerplexity(args: Record<string, unknown>): Promise<string> {
    const typedArgs = args as { message: string; chat_id?: string };

    // Use modular search engine - now returns SearchResult with url as chat_id
    const searchResult = await this.searchEngine.performSearch(typedArgs.message);

    // Use modular database manager with URL-based chat_id
    const chatIdFromUrl = searchResult.url;
    const getChatHistoryFn = (chatId: string) => this.databaseManager.getChatHistory(chatId);
    const saveChatMessageFn = (
      chatId: string,
      message: { role: "user" | "assistant"; content: string },
    ) => this.databaseManager.saveChatMessage(chatId, message.role, message.content);

    // T012: Use URL as chat_id in response, pass answer to chatPerplexity
    // Override the chat_id with the actual Perplexity URL
    return await chatPerplexity(
      { ...typedArgs, chat_id: chatIdFromUrl },
      {} as never, // Context not needed with modular approach
      () => Promise.resolve(searchResult.answer),
      getChatHistoryFn,
      saveChatMessageFn,
    );
  }

  // T013: Updated to destructure SearchResult
  private async handleGetDocumentation(args: Record<string, unknown>): Promise<string> {
    const typedArgs = args as { query: string; context?: string };
    const { answer } = await this.searchEngine.performSearch(
      `Documentation for ${typedArgs.query}: ${typedArgs.context || ""}`,
    );
    return answer;
  }

  // T014: Updated to destructure SearchResult
  private async handleFindApis(args: Record<string, unknown>): Promise<string> {
    const typedArgs = args as { requirement: string; context?: string };
    const { answer } = await this.searchEngine.performSearch(
      `Find APIs for ${typedArgs.requirement}: ${typedArgs.context || ""}`,
    );
    return answer;
  }

  // T015: Updated to destructure SearchResult
  private async handleCheckDeprecatedCode(args: Record<string, unknown>): Promise<string> {
    const typedArgs = args as { code: string; technology?: string };
    const { answer } = await this.searchEngine.performSearch(
      `Check if this ${typedArgs.technology || "code"} is deprecated: ${typedArgs.code}`,
    );
    return answer;
  }

  // T015: Updated to destructure SearchResult
  private async handleSearch(args: Record<string, unknown>): Promise<string> {
    const typedArgs = args as {
      query: string;
      detail_level?: "brief" | "normal" | "detailed";
      stream?: boolean;
    };

    const { answer } = await this.searchEngine.performSearch(typedArgs.query);
    return answer;
  }

  private async handleExtractUrlContent(args: Record<string, unknown>): Promise<string> {
    const typedArgs = args as { url: string; depth?: number };

    // Ensure browser is initialized
    if (!this.browserManager.isReady()) {
      await this.browserManager.initialize();
    }

    // Create PuppeteerContext from BrowserManager
    const ctx = this.createPuppeteerContext();

    return await extractUrlContent(typedArgs, ctx);
  }

  private createPuppeteerContext() {
    return this.browserManager.getPuppeteerContext();
  }

  private setupToolHandlers(): void {
    const toolHandlers = createToolHandlersRegistry({
      chat_perplexity: this.handleChatPerplexity.bind(this),
      get_documentation: this.handleGetDocumentation.bind(this),
      find_apis: this.handleFindApis.bind(this),
      check_deprecated_code: this.handleCheckDeprecatedCode.bind(this),
      search: this.handleSearch.bind(this),
      extract_url_content: this.handleExtractUrlContent.bind(this),
    });

    setupToolHandlers(this.server, toolHandlers);
  }

  async run(): Promise<void> {
    try {
      logInfo("Creating StdioServerTransport...");
      const transport = new StdioServerTransport();

      logInfo("Starting PerplexityServer...");
      logInfo(`Tools registered: ${Object.keys(this.getToolHandlersRegistry()).join(", ")}`);

      logInfo("Attempting to connect server to transport...");
      await this.server.connect(transport);
      logInfo("PerplexityServer connected and ready");
      logInfo("Server is listening for requests...");

      // Keep the process alive
      process.stdin.resume();
    } catch (error) {
      logError("Failed to start server:", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      process.exit(1);
    }
  }

  private getToolHandlersRegistry() {
    return {
      chat_perplexity: this.handleChatPerplexity.bind(this),
      get_documentation: this.handleGetDocumentation.bind(this),
      find_apis: this.handleFindApis.bind(this),
      check_deprecated_code: this.handleCheckDeprecatedCode.bind(this),
      search: this.handleSearch.bind(this),
      extract_url_content: this.handleExtractUrlContent.bind(this),
    };
  }

  // Getters for testing
  public getBrowserManager(): IBrowserManager {
    return this.browserManager;
  }

  public getSearchEngine(): ISearchEngine {
    return this.searchEngine;
  }

  public getDatabaseManager(): IDatabaseManager {
    return this.databaseManager;
  }
}
