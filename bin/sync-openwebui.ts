#!/usr/bin/env bun
/**
 * CLI script to sync RAG archive to OpenWebUI knowledge base
 * 
 * Usage:
 *   pnpm sync:openwebui [--verbose]
 * 
 * Environment variables:
 *   OPENWEBUI_URL - OpenWebUI instance URL (default: http://localhost:8090)
 *   OPENWEBUI_API_KEY - API key for authentication (required)
 *   OPENWEBUI_KB_NAME - Knowledge base name (default: "Perplexity RAG Archive")
 */
import { OpenWebUISyncer, OpenWebUISyncError } from "../src/utils/openwebui-sync.js";
import { logInfo, logError } from "../src/utils/logging.js";
import { CONFIG } from "../src/server/config.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const verbose = args.includes("--verbose") || args.includes("-v");

  try {
    logInfo("Starting OpenWebUI RAG sync...");
    logInfo(`  Archive: ${CONFIG.RAG_ARCHIVE_PATH}`);
    logInfo(`  Target: ${CONFIG.OPENWEBUI_URL}`);
    logInfo(`  Knowledge Base: ${CONFIG.OPENWEBUI_KB_NAME}`);

    const syncer = new OpenWebUISyncer();
    syncer.setVerbose(verbose);
    
    // Validate config early to provide clear error message
    syncer.validateConfig();

    const result = await syncer.sync();

    if (result.success) {
      if (result.skipped) {
        logInfo("Already up to date - archive unchanged since last sync");
      } else {
        logInfo("Sync completed successfully!");
        logInfo(`  Knowledge Base: ${result.knowledgeBaseName}`);
        logInfo(`  Knowledge Base ID: ${result.knowledgeBaseId}`);
        logInfo(`  Files Uploaded: ${result.filesUploaded}`);
        logInfo(`  Records Processed: ${result.recordsProcessed}`);
      }
      process.exit(0);
    } else {
      logError(`Sync failed: ${result.error}`);
      process.exit(1);
    }
  } catch (error) {
    if (error instanceof OpenWebUISyncError) {
      logError(`Sync error [${error.code}]: ${error.message}`);
    } else {
      logError(`Fatal error: ${error instanceof Error ? error.message : String(error)}`);
    }
    process.exit(1);
  }
}

main();
