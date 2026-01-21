/**
 * RagArchiver - Handles local RAG document storage
 * Appends chat interactions to a JSONL file for downstream RAG pipelines
 */
import crypto from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { RagDocument, RagDocumentMetadata } from "../../types/index.js";
import { logError, logInfo, logWarn } from "../../utils/logging.js";
import { CONFIG } from "../config.js";

/**
 * RagArchiver class for archiving chat interactions to JSONL format.
 * Supports fire-and-forget logging with atomic writes using fs.appendFile.
 */
export class RagArchiver {
  private readonly archivePath: string;
  private isWritable = false;

  /**
   * Creates a new RagArchiver instance.
   * @param archivePath - Optional custom path for the archive file. Defaults to CONFIG.RAG_ARCHIVE_PATH.
   */
  constructor(archivePath?: string) {
    this.archivePath = archivePath ?? CONFIG.RAG_ARCHIVE_PATH;
  }

  /**
   * Ensures the directory for the archive file exists.
   * Creates nested directories if they don't exist.
   * Also validates that the path is writable.
   */
  async ensureDirectory(): Promise<void> {
    const dir = path.dirname(this.archivePath);
    try {
      await fs.mkdir(dir, { recursive: true });
      this.isWritable = true;
      logInfo(`RAG archive directory ensured: ${dir}`);
    } catch (error) {
      this.logError("ensureDirectory", error);
      this.isWritable = false;
    }

    // Validate writability by attempting to touch the file
    await this.validateWritability();
  }

  /**
   * Validates that the archive path is writable.
   * Logs a warning if unwritable but does not throw.
   */
  private async validateWritability(): Promise<void> {
    try {
      // Try to open file for append (creates if not exists)
      const handle = await fs.open(this.archivePath, "a");
      await handle.close();
      this.isWritable = true;
    } catch (error) {
      this.isWritable = false;
      logWarn(`RAG archive path is not writable: ${this.archivePath}`);
      this.logError("validateWritability", error);
    }
  }

  /**
   * Logs a single RagDocument to the archive file.
   * Uses fs.appendFile for POSIX atomic append semantics.
   * Fire-and-forget: errors are logged but not thrown.
   * 
   * @param doc - The RagDocument to archive (without id and timestamp, which are generated)
   */
  async log(doc: Omit<RagDocument, "id" | "timestamp">): Promise<void> {
    if (!this.isWritable) {
      logWarn("RAG archive is not writable, skipping log");
      return;
    }

    const fullDoc: RagDocument = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...doc,
    };

    const jsonLine = JSON.stringify(fullDoc) + "\n";

    try {
      await fs.appendFile(this.archivePath, jsonLine, "utf-8");
    } catch (error) {
      this.logError("log", error);
    }
  }

  /**
   * Logs a complete interaction (user message + assistant response) to the archive.
   * Convenience method that creates two RagDocument entries.
   * 
   * @param chatId - The chat/conversation identifier
   * @param userMessage - The user's message content
   * @param assistantResponse - The assistant's response content
   * @param metadata - Optional metadata to include (model, citations, research_mode)
   */
  async logInteraction(
    chatId: string,
    userMessage: string,
    assistantResponse: string,
    metadata?: Partial<Omit<RagDocumentMetadata, "source">>,
  ): Promise<void> {
    const baseMetadata: RagDocumentMetadata = {
      source: "perplexity-mcp-zerver",
      ...metadata,
    };

    // Log user message
    await this.log({
      chat_id: chatId,
      role: "user",
      content: userMessage,
      metadata: { source: "perplexity-mcp-zerver" },
    });

    // Log assistant response with full metadata (including citations)
    await this.log({
      chat_id: chatId,
      role: "assistant",
      content: assistantResponse,
      metadata: baseMetadata,
    });
  }

  /**
   * Internal error handler that logs errors to stderr without throwing.
   * Ensures fire-and-forget semantics for all I/O operations.
   * 
   * @param operation - The operation that failed
   * @param error - The error that occurred
   */
  private logError(operation: string, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    logError(`RagArchiver.${operation} failed: ${message}`);
  }

  /**
   * Gets the configured archive path.
   * Useful for logging and debugging.
   */
  getArchivePath(): string {
    return this.archivePath;
  }
}
