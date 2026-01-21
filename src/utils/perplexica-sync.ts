/**
 * PerplexicaSyncer - Syncs local RAG archive to Perplexica
 *
 * Uses Perplexica's /api/uploads endpoint to upload documents
 * for local AI-powered search with embeddings.
 */

import { createReadStream, existsSync } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createInterface } from "node:readline";
import { dirname } from "node:path";
import { CONFIG } from "../server/config.js";
import type {
  RagDocument,
  PerplexicaSyncConfig,
  PerplexicaSyncState,
  PerplexicaSyncResult,
  PerplexicaUploadResponse,
} from "../types/index.js";

/**
 * Default sync state for first-time sync
 */
const DEFAULT_SYNC_STATE: PerplexicaSyncState = {
  lastSyncTime: "",
  syncedDocumentIds: [],
  totalSynced: 0,
};

/**
 * Syncs local RAG archive to Perplexica for local AI search
 */
export class PerplexicaSyncer {
  private readonly config: PerplexicaSyncConfig;

  constructor(config: Partial<PerplexicaSyncConfig> = {}) {
    this.config = {
      perplexicaUrl: config.perplexicaUrl ?? CONFIG.PERPLEXICA_URL,
      archivePath: config.archivePath ?? CONFIG.RAG_ARCHIVE_PATH,
      syncStatePath: config.syncStatePath ?? CONFIG.PERPLEXICA_SYNC_STATE_PATH,
      embeddingModel: config.embeddingModel ?? CONFIG.PERPLEXICA_EMBEDDING_MODEL,
      embeddingProvider: config.embeddingProvider ?? CONFIG.PERPLEXICA_EMBEDDING_PROVIDER,
      batchSize: config.batchSize ?? CONFIG.PERPLEXICA_BATCH_SIZE,
    };
  }

  /**
   * Load sync state from disk
   */
  async loadSyncState(): Promise<PerplexicaSyncState> {
    try {
      if (!existsSync(this.config.syncStatePath)) {
        return { ...DEFAULT_SYNC_STATE };
      }
      const content = await readFile(this.config.syncStatePath, "utf-8");
      return JSON.parse(content) as PerplexicaSyncState;
    } catch {
      return { ...DEFAULT_SYNC_STATE };
    }
  }

  /**
   * Save sync state to disk
   */
  async saveSyncState(state: PerplexicaSyncState): Promise<void> {
    const dir = dirname(this.config.syncStatePath);
    await mkdir(dir, { recursive: true });
    await writeFile(this.config.syncStatePath, JSON.stringify(state, null, 2));
  }

  /**
   * Convert a RagDocument to a text file for upload
   */
  convertToTextFile(doc: RagDocument): { content: string; filename: string } {
    const lines = [
      `# ${doc.role === "user" ? "Question" : "Answer"}`,
      "",
      `**Chat ID:** ${doc.chat_id}`,
      `**Timestamp:** ${doc.timestamp}`,
      `**Role:** ${doc.role}`,
    ];

    if (doc.metadata.model) {
      lines.push(`**Model:** ${doc.metadata.model}`);
    }

    if (doc.metadata.research_mode) {
      lines.push(`**Research Mode:** ${doc.metadata.research_mode}`);
    }

    if (doc.metadata.citations && doc.metadata.citations.length > 0) {
      lines.push(`**Citations:** ${doc.metadata.citations.join(", ")}`);
    }

    lines.push("", "---", "", doc.content);

    // Create a safe filename
    const dateStr = new Date(doc.timestamp).toISOString().slice(0, 10);
    const safeId = doc.id.slice(0, 8);
    const filename = `rag_${dateStr}_${doc.role}_${safeId}.txt`;

    return {
      content: lines.join("\n"),
      filename,
    };
  }

  /**
   * Check if a document has already been synced
   */
  isAlreadySynced(docId: string, state: PerplexicaSyncState): boolean {
    return state.syncedDocumentIds.includes(docId);
  }

  /**
   * Read documents from JSONL archive
   */
  async readArchive(): Promise<RagDocument[]> {
    if (!existsSync(this.config.archivePath)) {
      return [];
    }

    const documents: RagDocument[] = [];
    const fileStream = createReadStream(this.config.archivePath);
    const rl = createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      if (line.trim()) {
        try {
          documents.push(JSON.parse(line) as RagDocument);
        } catch {
          // Skip malformed lines
          console.error(`Skipping malformed JSON line: ${line.slice(0, 50)}...`);
        }
      }
    }

    return documents;
  }

  /**
   * Upload documents to Perplexica
   */
  async uploadDocuments(docs: RagDocument[]): Promise<PerplexicaUploadResponse> {
    const formData = new FormData();

    for (const doc of docs) {
      const { content, filename } = this.convertToTextFile(doc);
      const blob = new Blob([content], { type: "text/plain" });
      formData.append("files", blob, filename);
    }

    formData.append("embedding_model_key", this.config.embeddingModel);
    formData.append("embedding_model_provider_id", this.config.embeddingProvider);

    const response = await fetch(`${this.config.perplexicaUrl}/api/uploads`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Perplexica upload failed (${response.status}): ${errorText}`);
    }

    return (await response.json()) as PerplexicaUploadResponse;
  }

  /**
   * Check if Perplexica is available
   */
  async checkConnection(): Promise<boolean> {
    try {
      const response = await fetch(this.config.perplexicaUrl, {
        method: "HEAD",
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Run the sync operation
   */
  async sync(options: { dryRun?: boolean; verbose?: boolean } = {}): Promise<PerplexicaSyncResult> {
    const { dryRun = false, verbose = false } = options;
    const result: PerplexicaSyncResult = {
      success: false,
      newDocumentsSynced: 0,
      skippedDocuments: 0,
      errors: [],
    };

    // Check Perplexica connection
    if (!dryRun) {
      const isAvailable = await this.checkConnection();
      if (!isAvailable) {
        result.errors.push(`Perplexica not available at ${this.config.perplexicaUrl}`);
        return result;
      }
    }

    // Load sync state
    const state = await this.loadSyncState();
    if (verbose) {
      console.log(`Loaded sync state: ${state.totalSynced} documents previously synced`);
    }

    // Read archive
    const documents = await this.readArchive();
    if (verbose) {
      console.log(`Found ${documents.length} documents in archive`);
    }

    if (documents.length === 0) {
      if (verbose) {
        console.log("No documents to sync");
      }
      result.success = true;
      return result;
    }

    // Filter out already-synced documents
    const newDocuments = documents.filter(
      (doc) => !this.isAlreadySynced(doc.id, state)
    );
    result.skippedDocuments = documents.length - newDocuments.length;

    if (verbose) {
      console.log(`${newDocuments.length} new documents to sync, ${result.skippedDocuments} skipped`);
    }

    if (newDocuments.length === 0) {
      result.success = true;
      return result;
    }

    if (dryRun) {
      if (verbose) {
        console.log("Dry run - would sync:");
        for (const doc of newDocuments.slice(0, 5)) {
          console.log(`  - ${doc.id} (${doc.role}): ${doc.content.slice(0, 50)}...`);
        }
        if (newDocuments.length > 5) {
          console.log(`  ... and ${newDocuments.length - 5} more`);
        }
      }
      result.newDocumentsSynced = newDocuments.length;
      result.success = true;
      return result;
    }

    // Upload in batches
    const batches: RagDocument[][] = [];
    for (let i = 0; i < newDocuments.length; i += this.config.batchSize) {
      batches.push(newDocuments.slice(i, i + this.config.batchSize));
    }

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]!;
      if (verbose) {
        console.log(`Uploading batch ${i + 1}/${batches.length} (${batch.length} documents)`);
      }

      try {
        await this.uploadDocuments(batch);

        // Update state with synced IDs
        for (const doc of batch) {
          state.syncedDocumentIds.push(doc.id);
          result.newDocumentsSynced++;
        }

        // Save state after each batch (for resumability)
        state.totalSynced = state.syncedDocumentIds.length;
        state.lastSyncTime = new Date().toISOString();
        await this.saveSyncState(state);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        result.errors.push(`Batch ${i + 1} failed: ${errorMsg}`);
        if (verbose) {
          console.error(`Batch ${i + 1} failed: ${errorMsg}`);
        }
        // Continue with next batch
      }
    }

    result.success = result.errors.length === 0;
    return result;
  }
}
