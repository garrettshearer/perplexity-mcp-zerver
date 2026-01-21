import { homedir } from "node:os";
import { join } from "node:path";

export const CONFIG = {
  // Browser profile settings for Pro account persistence
  BROWSER_DATA_DIR: process.env["PERPLEXITY_BROWSER_DATA_DIR"] || join(homedir(), ".perplexity-mcp"),
  USE_PERSISTENT_PROFILE: process.env["PERPLEXITY_PERSISTENT_PROFILE"] !== "false",

  // RAG Archive configuration
  RAG_ARCHIVE_PATH: process.env["RAG_ARCHIVE_PATH"] || "./data/rag_archive.jsonl",

  /**
   * Browser headless mode control
   * - 'new': Modern headless (default, recommended)
   * - false: Visible browser window for debugging
   * 
   * Set PERPLEXITY_HEADLESS=false to show browser window
   */
  HEADLESS: process.env["PERPLEXITY_HEADLESS"] !== "false" ? "new" : false as "new" | false,

  SEARCH_COOLDOWN: 5000, // Restored from backup.ts for better Cloudflare handling
  PAGE_TIMEOUT: 180000, // Restored from backup.ts (3 minutes) for Cloudflare challenges
  SELECTOR_TIMEOUT: 90000, // Restored from backup.ts (1.5 minutes) for slow loading
  MAX_RETRIES: 10, // Restored from backup.ts for better resilience
  MCP_TIMEOUT_BUFFER: 60000, // Restored from backup.ts
  ANSWER_WAIT_TIMEOUT: 120000, // Restored from backup.ts (2 minutes)
  RECOVERY_WAIT_TIME: 15000, // Restored from backup.ts
  USER_AGENT:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  TIMEOUT_PROFILES: {
    navigation: 45000, // Restored from backup.ts for Cloudflare navigation
    selector: 15000, // Restored from backup.ts
    content: 120000, // Restored from backup.ts (2 minutes)
    recovery: 30000, // Restored from backup.ts
  },
  DEBUG: {
    CAPTURE_SCREENSHOTS: true, // Enable/disable debug screenshots
    MAX_SCREENSHOTS: 5, // Maximum number of screenshots to keep
    SCREENSHOT_ON_RECOVERY_SUCCESS: false, // Don't screenshot successful recoveries
  },

  // OpenWebUI sync configuration
  OPENWEBUI_URL: process.env["OPENWEBUI_URL"] || "http://localhost:8090",
  OPENWEBUI_API_KEY: process.env["OPENWEBUI_API_KEY"] || "",
  OPENWEBUI_KB_NAME: process.env["OPENWEBUI_KB_NAME"] || "Perplexity RAG Archive",

  // Sync operation settings
  OPENWEBUI_SYNC: {
    MAX_RETRIES: 3,
    RETRY_DELAY_MS: 1000,
    PROCESSING_TIMEOUT_MS: 300000, // 5 minutes
    POLL_INTERVAL_MS: 2000,
  } as const,
} as const;

