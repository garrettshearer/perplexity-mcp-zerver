/**
 * Tool arguments and results type definitions
 */

// ─── SEARCH RESULT TYPE ───────────────────────────────────────────────
/**
 * T008: SearchResult interface for structured search responses
 * Returns answer, URL (chat_id), and citations from Perplexity
 */
export interface SearchResult {
  /** The extracted answer text from Perplexity */
  answer: string;
  /** The Perplexity page URL (used as chat_id for continuity) */
  url: string;
  /** Array of citation URLs extracted from the answer */
  citations: string[];
}

// ─── SEARCH ENGINE INTERFACE ──────────────────────────────────────────
// T010: Updated to return Promise<SearchResult> instead of Promise<string>
export interface ISearchEngine {
  performSearch(query: string): Promise<SearchResult>;
}

// ─── TOOL HANDLER TYPES ───────────────────────────────────────────────
export type ToolHandler = (args: Record<string, unknown>) => Promise<string>;

export interface ToolHandlersRegistry {
  test_tool?: ToolHandler;
  existing_tool?: ToolHandler;
  failing_tool?: ToolHandler;
  timeout_tool?: ToolHandler;
  chat_perplexity?: ToolHandler;
  get_documentation?: ToolHandler;
  find_apis?: ToolHandler;
  check_deprecated_code?: ToolHandler;
  search?: ToolHandler;
  extract_url_content?: ToolHandler;
  // Allow additional tools via index signature
  [key: string]: ToolHandler | undefined;
}

// ─── TOOL ARGUMENT TYPES ──────────────────────────────────────────────
export interface ChatPerplexityArgs {
  message: string;
  chat_id?: string;
  chat_url?: string;
  space_id?: string;
  /** Optional: AI model to use for this chat (e.g., "Claude 3.5 Sonnet", "GPT-4o") */
  model?: string;
}

export interface ExtractUrlContentArgs {
  url: string;
  depth?: number;
}

export interface GetDocumentationArgs {
  query: string;
  context?: string;
}

export interface FindApisArgs {
  requirement: string;
  context?: string;
}

export interface CheckDeprecatedCodeArgs {
  code: string;
  technology?: string;
}

export interface SearchArgs {
  query: string;
  detail_level?: "brief" | "normal" | "detailed";
  space_id?: string;
  /** Optional: AI model to use for this search (e.g., "Claude 3.5 Sonnet", "GPT-4o") */
  model?: string;
}

// ─── UNION TYPES ──────────────────────────────────────────────────────
export type ToolArgs =
  | ChatPerplexityArgs
  | ExtractUrlContentArgs
  | GetDocumentationArgs
  | FindApisArgs
  | CheckDeprecatedCodeArgs
  | SearchArgs;
