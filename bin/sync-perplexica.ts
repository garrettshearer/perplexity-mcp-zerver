#!/usr/bin/env tsx
/**
 * Perplexica Sync CLI
 *
 * Syncs local RAG archive to Perplexica for local AI-powered search.
 *
 * Usage:
 *   pnpm sync:perplexica [options]
 *
 * Options:
 *   --verbose             Show detailed progress
 *   --dry-run             Preview sync without uploading
 *   --perplexica-url URL  Override Perplexica URL (default: http://localhost:3001)
 *   --embedding-model     Override embedding model (default: nomic-embed-text)
 *   --embedding-provider  Override provider (default: ollama)
 */

import { PerplexicaSyncer } from "../src/utils/perplexica-sync.js";

function parseArgs(args: string[]): {
  verbose: boolean;
  dryRun: boolean;
  perplexicaUrl?: string;
  embeddingModel?: string;
  embeddingProvider?: string;
} {
  const result = {
    verbose: false,
    dryRun: false,
    perplexicaUrl: undefined as string | undefined,
    embeddingModel: undefined as string | undefined,
    embeddingProvider: undefined as string | undefined,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--verbose" || arg === "-v") {
      result.verbose = true;
    } else if (arg === "--dry-run" || arg === "-n") {
      result.dryRun = true;
    } else if (arg === "--perplexica-url" && args[i + 1]) {
      result.perplexicaUrl = args[++i];
    } else if (arg === "--embedding-model" && args[i + 1]) {
      result.embeddingModel = args[++i];
    } else if (arg === "--embedding-provider" && args[i + 1]) {
      result.embeddingProvider = args[++i];
    } else if (arg === "--help" || arg === "-h") {
      console.log(`
Perplexica Sync CLI - Sync RAG archive to Perplexica

Usage:
  pnpm sync:perplexica [options]

Options:
  -v, --verbose             Show detailed progress
  -n, --dry-run             Preview sync without uploading
  --perplexica-url URL      Override Perplexica URL (default: http://localhost:3001)
  --embedding-model MODEL   Override embedding model (default: nomic-embed-text)
  --embedding-provider ID   Override provider (default: ollama)
  -h, --help                Show this help message

Examples:
  pnpm sync:perplexica --verbose
  pnpm sync:perplexica --dry-run
  pnpm sync:perplexica --perplexica-url http://localhost:3001
`);
      process.exit(0);
    }
  }

  return result;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  console.log("🔄 Perplexica RAG Sync");
  console.log("=".repeat(40));

  if (args.dryRun) {
    console.log("📋 DRY RUN MODE - No changes will be made\n");
  }

  const syncer = new PerplexicaSyncer({
    perplexicaUrl: args.perplexicaUrl,
    embeddingModel: args.embeddingModel,
    embeddingProvider: args.embeddingProvider,
  });

  try {
    const result = await syncer.sync({
      dryRun: args.dryRun,
      verbose: args.verbose,
    });

    console.log("\n" + "=".repeat(40));
    console.log("📊 Sync Results:");
    console.log(`   ✅ New documents synced: ${result.newDocumentsSynced}`);
    console.log(`   ⏭️  Documents skipped:   ${result.skippedDocuments}`);

    if (result.errors.length > 0) {
      console.log(`   ❌ Errors: ${result.errors.length}`);
      for (const error of result.errors) {
        console.log(`      - ${error}`);
      }
    }

    console.log("\n" + (result.success ? "✅ Sync completed successfully" : "⚠️  Sync completed with errors"));
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error("\n❌ Sync failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
