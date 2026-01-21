/**
 * Main type definitions export file
 * Centralized exports from focused type modules
 */

// ─── RAG DOCUMENT TYPES ───────────────────────────────────────────────
/**
 * Metadata for RAG document entries.
 * Contains source attribution and optional contextual information.
 */
export interface RagDocumentMetadata {
  source: 'perplexity-mcp-zerver';
  model?: string;
  citations?: string[];
  research_mode?: string;
}

/**
 * RAG document entry for local storage archival.
 * Each interaction (user message or assistant response) becomes one RagDocument.
 */
export interface RagDocument {
  /** Unique identifier for this specific message (UUID) */
  id: string;
  /** Chat/conversation identifier (Perplexity URL or generated UUID) */
  chat_id: string;
  /** ISO 8601 timestamp of when the message was archived */
  timestamp: string;
  /** Role of the message sender */
  role: 'user' | 'assistant';
  /** The actual message content */
  content: string;
  /** Additional metadata about the message */
  metadata: RagDocumentMetadata;
}

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
  SearchResult,
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
// ─── OPENWEBUI INTEGRATION TYPES ──────────────────────────────────────

/**
 * OpenWebUI configuration loaded from environment variables
 */
export interface OpenWebUIConfig {
  /** Base URL of OpenWebUI instance (default: http://localhost:8090) */
  url: string;
  /** API key for authentication (required) */
  apiKey: string;
  /** Knowledge base name to create/update (default: "Perplexity RAG Archive") */
  knowledgeBaseName: string;
}

/**
 * OpenWebUI file upload response
 */
export interface OpenWebUIFileResponse {
  id: string;
  filename: string;
  created_at?: string;
}

/**
 * OpenWebUI file processing status
 */
export interface OpenWebUIFileStatus {
  status: 'pending' | 'completed' | 'failed';
  error?: string;
}

/**
 * OpenWebUI knowledge base entity
 */
export interface OpenWebUIKnowledgeBase {
  id: string;
  name: string;
  description?: string;
  created_at?: string;
}

/**
 * Sync operation result
 */
export interface SyncResult {
  success: boolean;
  skipped: boolean;
  filesUploaded: number;
  knowledgeBaseName: string;
  knowledgeBaseId?: string;
  recordsProcessed: number;
  error?: string;
}

/**
 * Sync state for idempotency tracking
 */
export interface SyncState {
  lastSyncTimestamp: string;
  lastArchiveMtime: number;
  knowledgeBaseId?: string;
  lastFileId?: string;
}

// ─── PERPLEXICA INTEGRATION TYPES ─────────────────────────────────────

/**
 * Configuration for Perplexica sync operations
 */
export interface PerplexicaSyncConfig {
  /** Base URL of Perplexica instance (default: http://localhost:3001) */
  perplexicaUrl: string;
  /** Path to JSONL archive file */
  archivePath: string;
  /** Path to sync state JSON file */
  syncStatePath: string;
  /** Embedding model name (default: nomic-embed-text) */
  embeddingModel: string;
  /** Embedding model provider (default: ollama) */
  embeddingProvider: string;
  /** Number of documents to upload per batch */
  batchSize: number;
}

/**
 * Perplexica sync state for tracking synced documents
 */
export interface PerplexicaSyncState {
  /** ISO timestamp of last sync */
  lastSyncTime: string;
  /** Array of document IDs that have been synced */
  syncedDocumentIds: string[];
  /** Total count of synced documents */
  totalSynced: number;
}

/**
 * Result of a Perplexica sync operation
 */
export interface PerplexicaSyncResult {
  /** Whether the sync completed successfully */
  success: boolean;
  /** Count of newly synced documents */
  newDocumentsSynced: number;
  /** Count of documents skipped (already synced) */
  skippedDocuments: number;
  /** Array of error messages if any occurred */
  errors: string[];
}

/**
 * Response from Perplexica /api/uploads endpoint
 */
export interface PerplexicaUploadResponse {
  files: Array<{
    id: string;
    name: string;
    status?: string;
  }>;
}
