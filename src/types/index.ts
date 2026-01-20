/**
 * Main type definitions export file
 * Centralized exports from focused type modules
 */

// ─── RESEARCH MODE TYPE ───────────────────────────────────────────────
/**
 * Research mode for Perplexity search queries.
 * - 'search': Fast answers mode (default) - quick, concise responses
 * - 'deep-research': Comprehensive analysis mode - thorough, detailed research
 */
export type ResearchMode = "search" | "deep-research";

// ─── BROWSER & PUPPETEER TYPES ────────────────────────────────────────
export type {
  BrowserConfig,
  RecoveryContext,
  ErrorAnalysis,
  PuppeteerContext,
  IBrowserManager,
  PageContentResult,
  RecursiveFetchResult,
  ModelSwitchResult,
  SendChatMessageOptions,
  SendChatMessageResult,
} from "./browser.js";

// ─── DATABASE & CHAT TYPES ────────────────────────────────────────────
export type {
  ChatMessage,
  ChatResult,
  IDatabaseManager,
} from "./database.js";

// ─── TOOL & SEARCH TYPES ──────────────────────────────────────────────
export type {
  ISearchEngine,
  ToolHandler,
  ToolHandlersRegistry,
  ChatPerplexityArgs,
  ExtractUrlContentArgs,
  GetDocumentationArgs,
  FindApisArgs,
  CheckDeprecatedCodeArgs,
  SearchArgs,
  ToolArgs,
} from "./tools.js";

// ─── SERVER TYPES ─────────────────────────────────────────────────────
export type { ServerDependencies } from "./server.js";
