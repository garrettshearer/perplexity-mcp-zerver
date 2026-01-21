/**
 * OpenWebUI RAG Archive Sync Module
 * 
 * Syncs the local JSONL RAG archive to an OpenWebUI knowledge base via REST API.
 * Supports idempotent syncs by tracking archive modification time.
 */
import axios, { type AxiosInstance, type AxiosError } from "axios";
import { readFile, writeFile, stat } from "node:fs/promises";
import { createReadStream, existsSync } from "node:fs";
import { basename, resolve } from "node:path";
import FormData from "form-data";
import { CONFIG } from "../server/config.js";
import { logInfo, logWarn, logError } from "./logging.js";
import type {
  OpenWebUIConfig,
  OpenWebUIFileResponse,
  OpenWebUIFileStatus,
  OpenWebUIKnowledgeBase,
  SyncResult,
  SyncState,
} from "../types/index.js";

/**
 * Custom error class for OpenWebUI sync operations
 */
export class OpenWebUISyncError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = "OpenWebUISyncError";
  }
}

/** Path to sync state file for idempotency tracking */
const SYNC_STATE_PATH = ".sync-state.json";

/**
 * OpenWebUI Sync Client
 * 
 * Handles uploading RAG archive files to OpenWebUI knowledge bases.
 */
export class OpenWebUISyncer {
  private readonly config: OpenWebUIConfig;
  private readonly client: AxiosInstance;
  private verbose = false;

  /**
   * Create a new OpenWebUI syncer instance
   * @param config - Optional configuration override (defaults to CONFIG values)
   */
  constructor(config?: Partial<OpenWebUIConfig>) {
    this.config = {
      url: config?.url ?? CONFIG.OPENWEBUI_URL,
      apiKey: config?.apiKey ?? CONFIG.OPENWEBUI_API_KEY,
      knowledgeBaseName: config?.knowledgeBaseName ?? CONFIG.OPENWEBUI_KB_NAME,
    };

    this.client = axios.create({
      baseURL: this.config.url,
      timeout: CONFIG.OPENWEBUI_SYNC.PROCESSING_TIMEOUT_MS,
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
      },
    });
  }

  /**
   * Enable verbose logging for debugging
   */
  setVerbose(verbose: boolean): void {
    this.verbose = verbose;
  }

  /**
   * Validate that required configuration is present
   * @throws {OpenWebUISyncError} If API key is not set
   */
  validateConfig(): void {
    if (!this.config.apiKey) {
      throw new OpenWebUISyncError(
        "Invalid API key - check OPENWEBUI_API_KEY environment variable",
        "AUTH_MISSING",
        401
      );
    }
  }

  /**
   * Upload a file to OpenWebUI
   * @param filePath - Path to the file to upload
   * @returns File response with ID
   */
  async uploadFile(filePath: string): Promise<OpenWebUIFileResponse> {
    const absolutePath = resolve(filePath);
    
    if (!existsSync(absolutePath)) {
      throw new OpenWebUISyncError(
        `Archive file not found: ${absolutePath}`,
        "FILE_NOT_FOUND"
      );
    }

    const form = new FormData();
    form.append("file", createReadStream(absolutePath), {
      filename: basename(absolutePath),
    });

    try {
      logInfo(`Uploading file: ${basename(absolutePath)}`);
      
      const response = await this.retryRequest(async () => {
        return this.client.post<OpenWebUIFileResponse>("/api/v1/files/", form, {
          headers: {
            ...form.getHeaders(),
          },
        });
      });

      if (this.verbose) {
        logInfo(`File uploaded successfully`, { fileId: response.data.id });
      }

      return response.data;
    } catch (error) {
      this.handleAxiosError(error, "File upload failed");
      throw error; // Re-throw if not handled
    }
  }

  /**
   * Poll for file processing completion
   * @param fileId - ID of the uploaded file
   * @returns Final processing status
   */
  async waitForProcessing(fileId: string): Promise<OpenWebUIFileStatus> {
    const maxAttempts = Math.ceil(
      CONFIG.OPENWEBUI_SYNC.PROCESSING_TIMEOUT_MS / CONFIG.OPENWEBUI_SYNC.POLL_INTERVAL_MS
    );
    
    logInfo(`Waiting for file processing...`);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await this.client.get<OpenWebUIFileStatus>(
          `/api/v1/files/${fileId}/process/status`
        );
        
        const status = response.data.status;
        
        if (status === "completed") {
          logInfo("File processing completed");
          return response.data;
        }
        
        if (status === "failed") {
          throw new OpenWebUISyncError(
            `File processing failed: ${response.data.error || "Unknown error"}`,
            "PROCESSING_FAILED"
          );
        }

        // Still pending, wait and retry
        if (this.verbose && attempt % 5 === 0) {
          logInfo(`Processing status: ${status} (attempt ${attempt + 1}/${maxAttempts})`);
        }
        
        await this.sleep(CONFIG.OPENWEBUI_SYNC.POLL_INTERVAL_MS);
      } catch (error) {
        if (error instanceof OpenWebUISyncError) {
          throw error;
        }
        // On transient errors, continue polling
        if (this.verbose) {
          logWarn(`Polling error, retrying...`, { error: String(error) });
        }
      }
    }

    throw new OpenWebUISyncError(
      `Processing timeout after ${CONFIG.OPENWEBUI_SYNC.PROCESSING_TIMEOUT_MS / 1000}s - file may still be processing`,
      "PROCESSING_TIMEOUT"
    );
  }

  /**
   * Find existing knowledge base by name or create a new one
   * @param name - Name of the knowledge base
   * @returns Knowledge base object
   */
  async getOrCreateKnowledgeBase(name: string): Promise<OpenWebUIKnowledgeBase> {
    try {
      // First, try to find existing KB
      const listResponse = await this.retryRequest(async () => {
        return this.client.get<OpenWebUIKnowledgeBase[]>("/api/v1/knowledge/");
      });

      const existing = listResponse.data.find(kb => kb.name === name);
      if (existing) {
        logInfo(`Found existing knowledge base: ${name}`, { id: existing.id });
        return existing;
      }

      // Create new KB
      logInfo(`Creating new knowledge base: ${name}`);
      const createResponse = await this.retryRequest(async () => {
        return this.client.post<OpenWebUIKnowledgeBase>("/api/v1/knowledge/create", {
          name,
          description: "RAG archive synced from Perplexity MCP server",
        });
      });

      logInfo(`Knowledge base created`, { id: createResponse.data.id });
      return createResponse.data;
    } catch (error) {
      this.handleAxiosError(error, "Knowledge base operation failed");
      throw error;
    }
  }

  /**
   * Associate an uploaded file with a knowledge base
   * @param kbId - Knowledge base ID
   * @param fileId - File ID to associate
   */
  async addFileToKnowledgeBase(kbId: string, fileId: string): Promise<void> {
    try {
      logInfo(`Adding file to knowledge base...`);
      
      await this.retryRequest(async () => {
        return this.client.post(`/api/v1/knowledge/${kbId}/file/add`, {
          file_id: fileId,
        });
      });

      logInfo("File added to knowledge base successfully");
    } catch (error) {
      this.handleAxiosError(error, "Failed to add file to knowledge base");
      throw error;
    }
  }

  /**
   * Load sync state from disk
   * @returns Sync state or null if not found
   */
  async loadSyncState(): Promise<SyncState | null> {
    try {
      const content = await readFile(SYNC_STATE_PATH, "utf-8");
      return JSON.parse(content) as SyncState;
    } catch {
      return null;
    }
  }

  /**
   * Save sync state to disk
   * @param state - State to save
   */
  async saveSyncState(state: SyncState): Promise<void> {
    await writeFile(SYNC_STATE_PATH, JSON.stringify(state, null, 2));
  }

  /**
   * Get archive file modification time
   * @param archivePath - Path to archive file
   * @returns Modification time in milliseconds
   */
  async getArchiveMtime(archivePath: string): Promise<number> {
    const stats = await stat(archivePath);
    return stats.mtimeMs;
  }

  /**
   * Main sync orchestration method
   * Uploads the RAG archive to OpenWebUI and associates it with a knowledge base
   * 
   * @param archivePath - Optional path to archive (defaults to CONFIG.RAG_ARCHIVE_PATH)
   * @returns Sync result
   */
  async sync(archivePath?: string): Promise<SyncResult> {
    const archive = archivePath ?? CONFIG.RAG_ARCHIVE_PATH;
    
    try {
      this.validateConfig();

      // Check if archive exists
      if (!existsSync(archive)) {
        throw new OpenWebUISyncError(
          `RAG archive not found at: ${archive}. Run some queries first to create it.`,
          "ARCHIVE_NOT_FOUND"
        );
      }

      // Check for idempotency - skip if unchanged
      const currentMtime = await this.getArchiveMtime(archive);
      const previousState = await this.loadSyncState();

      if (previousState && previousState.lastArchiveMtime === currentMtime) {
        logInfo("Archive unchanged since last sync - skipping");
        return {
          success: true,
          skipped: true,
          filesUploaded: 0,
          knowledgeBaseName: this.config.knowledgeBaseName,
          knowledgeBaseId: previousState.knowledgeBaseId,
          recordsProcessed: 0,
        };
      }

      // Count records in archive
      const archiveContent = await readFile(archive, "utf-8");
      const lines = archiveContent.trim().split("\n").filter(line => line.length > 0);
      const recordCount = lines.length;

      logInfo(`Starting sync of ${recordCount} records from ${archive}`);

      // Step 1: Upload file
      const fileResponse = await this.uploadFile(archive);

      // Step 2: Wait for processing
      await this.waitForProcessing(fileResponse.id);

      // Step 3: Get or create knowledge base
      const kb = await this.getOrCreateKnowledgeBase(this.config.knowledgeBaseName);

      // Step 4: Associate file with KB
      await this.addFileToKnowledgeBase(kb.id, fileResponse.id);

      // Save sync state for idempotency
      await this.saveSyncState({
        lastSyncTimestamp: new Date().toISOString(),
        lastArchiveMtime: currentMtime,
        knowledgeBaseId: kb.id,
        lastFileId: fileResponse.id,
      });

      return {
        success: true,
        skipped: false,
        filesUploaded: 1,
        knowledgeBaseName: kb.name,
        knowledgeBaseId: kb.id,
        recordsProcessed: recordCount,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logError(`Sync failed: ${message}`);
      
      return {
        success: false,
        skipped: false,
        filesUploaded: 0,
        knowledgeBaseName: this.config.knowledgeBaseName,
        recordsProcessed: 0,
        error: message,
      };
    }
  }

  /**
   * Retry a request with exponential backoff
   */
  private async retryRequest<T>(
    fn: () => Promise<T>,
    maxRetries = CONFIG.OPENWEBUI_SYNC.MAX_RETRIES
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry client errors (4xx)
        if (axios.isAxiosError(error) && error.response?.status && error.response.status < 500) {
          throw error;
        }
        
        if (attempt < maxRetries) {
          const delay = CONFIG.OPENWEBUI_SYNC.RETRY_DELAY_MS * Math.pow(2, attempt);
          if (this.verbose) {
            logWarn(`Request failed, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
          }
          await this.sleep(delay);
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Handle axios errors and convert to OpenWebUISyncError
   */
  private handleAxiosError(error: unknown, context: string): never {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;

      if (status === 401) {
        throw new OpenWebUISyncError(
          "Invalid API key - check OPENWEBUI_API_KEY",
          "AUTH_INVALID",
          401
        );
      }

      if (status === 404) {
        throw new OpenWebUISyncError(
          "OpenWebUI endpoint not found - check OPENWEBUI_URL",
          "NOT_FOUND",
          404
        );
      }

      if (axiosError.code === "ECONNREFUSED") {
        throw new OpenWebUISyncError(
          "Cannot connect to OpenWebUI - ensure it's running at " + this.config.url,
          "CONNECTION_REFUSED"
        );
      }

      throw new OpenWebUISyncError(
        `${context}: ${axiosError.message}`,
        "HTTP_ERROR",
        status
      );
    }

    throw new OpenWebUISyncError(
      `${context}: ${error instanceof Error ? error.message : String(error)}`,
      "UNKNOWN_ERROR"
    );
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
