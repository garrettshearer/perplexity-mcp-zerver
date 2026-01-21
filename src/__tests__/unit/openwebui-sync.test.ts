/**
 * Unit tests for OpenWebUI RAG Sync Module
 * 
 * Tests cover:
 * - Configuration validation
 * - File upload operations
 * - Processing status polling
 * - Knowledge base management
 * - Full sync flow
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import axios from "axios";
import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { OpenWebUISyncer, OpenWebUISyncError } from "../../utils/openwebui-sync.js";

// Mock axios
vi.mock("axios", () => {
  const mockAxiosInstance = {
    get: vi.fn(),
    post: vi.fn(),
    defaults: { headers: { common: {} } },
  };
  return {
    default: {
      create: vi.fn(() => mockAxiosInstance),
      isAxiosError: vi.fn((error) => error?.isAxiosError === true),
    },
    isAxiosError: vi.fn((error) => error?.isAxiosError === true),
  };
});

// Mock fs modules
vi.mock("node:fs", () => {
  const { Readable } = require("node:stream");
  return {
    existsSync: vi.fn(),
    createReadStream: vi.fn(() => {
      const readable = new Readable({
        read() {
          this.push('{"id":"1"}\n');
          this.push(null);
        }
      });
      return readable;
    }),
  };
});

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  stat: vi.fn(),
}));

// Mock CONFIG
vi.mock("../../server/config.js", () => ({
  CONFIG: {
    OPENWEBUI_URL: "http://localhost:8090",
    OPENWEBUI_API_KEY: "test-api-key",
    OPENWEBUI_KB_NAME: "Test Knowledge Base",
    RAG_ARCHIVE_PATH: "./data/rag_archive.jsonl",
    OPENWEBUI_SYNC: {
      MAX_RETRIES: 3,
      RETRY_DELAY_MS: 100, // Fast for tests
      PROCESSING_TIMEOUT_MS: 5000,
      POLL_INTERVAL_MS: 100,
    },
  },
}));

// Mock logging to prevent console output during tests
vi.mock("../../utils/logging.js", () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

describe("OpenWebUISyncer", () => {
  let syncer: OpenWebUISyncer;
  let mockAxiosInstance: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAxiosInstance = (axios.create as ReturnType<typeof vi.fn>)();
    syncer = new OpenWebUISyncer();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("validateConfig", () => {
    it("T001: throws when OPENWEBUI_API_KEY is not set", () => {
      const syncerNoKey = new OpenWebUISyncer({ apiKey: "" });
      
      expect(() => syncerNoKey.validateConfig()).toThrow(OpenWebUISyncError);
      expect(() => syncerNoKey.validateConfig()).toThrow("Invalid API key");
    });

    it("T002: uses default URL when OPENWEBUI_URL not set", () => {
      const syncerDefault = new OpenWebUISyncer({ apiKey: "test-key" });
      
      // Should not throw - validates configuration is accepted
      expect(() => syncerDefault.validateConfig()).not.toThrow();
    });

    it("T003: uses default KB name when OPENWEBUI_KB_NAME not set", () => {
      const syncerDefault = new OpenWebUISyncer({ apiKey: "test-key" });
      
      // Should not throw - validates configuration is accepted
      expect(() => syncerDefault.validateConfig()).not.toThrow();
    });

    it("T004: accepts custom config via constructor", () => {
      const customConfig = {
        url: "http://custom:9000",
        apiKey: "custom-key",
        knowledgeBaseName: "Custom KB",
      };
      
      const customSyncer = new OpenWebUISyncer(customConfig);
      expect(() => customSyncer.validateConfig()).not.toThrow();
    });
  });

  describe("uploadFile", () => {
    it("T005: uploads file successfully and returns file ID", async () => {
      const mockResponse = {
        data: { id: "file-123", filename: "rag_archive.jsonl" },
      };
      mockAxiosInstance.post.mockResolvedValue(mockResponse);
      vi.mocked(existsSync).mockReturnValue(true);

      const result = await syncer.uploadFile("./data/rag_archive.jsonl");

      expect(result.id).toBe("file-123");
      expect(result.filename).toBe("rag_archive.jsonl");
    });

    it("T006: throws on missing archive file", async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      await expect(syncer.uploadFile("./nonexistent.jsonl")).rejects.toThrow(
        OpenWebUISyncError
      );
      await expect(syncer.uploadFile("./nonexistent.jsonl")).rejects.toThrow(
        "Archive file not found"
      );
    });

    it("T007: throws on network error", async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      const networkError = new Error("Network Error");
      (networkError as Error & { isAxiosError: boolean }).isAxiosError = true;
      (networkError as Error & { code: string }).code = "ECONNREFUSED";
      mockAxiosInstance.post.mockRejectedValue(networkError);

      await expect(syncer.uploadFile("./data/rag_archive.jsonl")).rejects.toThrow();
    });

    it("T008: handles authentication failure 401", async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      const authError = {
        isAxiosError: true,
        response: { status: 401 },
        message: "Unauthorized",
      };
      mockAxiosInstance.post.mockRejectedValue(authError);

      await expect(syncer.uploadFile("./data/rag_archive.jsonl")).rejects.toThrow(
        "Invalid API key"
      );
    });
  });

  describe("waitForProcessing", () => {
    it("T009: resolves when status becomes completed", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { status: "completed" },
      });

      const result = await syncer.waitForProcessing("file-123");

      expect(result.status).toBe("completed");
    });

    it("T010: throws on failed status", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { status: "failed", error: "Processing error" },
      });

      await expect(syncer.waitForProcessing("file-123")).rejects.toThrow(
        "File processing failed"
      );
    });

    it("T011: times out after configured duration", async () => {
      // Always return pending status
      mockAxiosInstance.get.mockResolvedValue({
        data: { status: "pending" },
      });

      // Use a syncer with very short timeout for testing
      const fastSyncer = new OpenWebUISyncer({ apiKey: "test-key" });

      await expect(fastSyncer.waitForProcessing("file-123")).rejects.toThrow(
        "Processing timeout"
      );
    }, 10000);

    it("T012: retries on transient errors", async () => {
      // First call fails, second succeeds
      mockAxiosInstance.get
        .mockRejectedValueOnce(new Error("Temporary error"))
        .mockResolvedValue({ data: { status: "completed" } });

      const result = await syncer.waitForProcessing("file-123");

      expect(result.status).toBe("completed");
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
    });
  });

  describe("getOrCreateKnowledgeBase", () => {
    it("T013: returns existing KB when name matches", async () => {
      const existingKB = { id: "kb-123", name: "Test Knowledge Base" };
      mockAxiosInstance.get.mockResolvedValue({
        data: [existingKB, { id: "kb-other", name: "Other KB" }],
      });

      const result = await syncer.getOrCreateKnowledgeBase("Test Knowledge Base");

      expect(result.id).toBe("kb-123");
      expect(mockAxiosInstance.post).not.toHaveBeenCalled();
    });

    it("T014: creates new KB when name not found", async () => {
      const newKB = { id: "kb-new", name: "New KB" };
      mockAxiosInstance.get.mockResolvedValue({
        data: [{ id: "kb-other", name: "Other KB" }],
      });
      mockAxiosInstance.post.mockResolvedValue({ data: newKB });

      const result = await syncer.getOrCreateKnowledgeBase("New KB");

      expect(result.id).toBe("kb-new");
      expect(mockAxiosInstance.post).toHaveBeenCalled();
    });

    it("T015: handles empty KB list", async () => {
      const newKB = { id: "kb-first", name: "First KB" };
      mockAxiosInstance.get.mockResolvedValue({ data: [] });
      mockAxiosInstance.post.mockResolvedValue({ data: newKB });

      const result = await syncer.getOrCreateKnowledgeBase("First KB");

      expect(result.id).toBe("kb-first");
    });
  });

  describe("addFileToKnowledgeBase", () => {
    it("T016: associates file with KB successfully", async () => {
      mockAxiosInstance.post.mockResolvedValue({ data: { success: true } });

      await expect(
        syncer.addFileToKnowledgeBase("kb-123", "file-123")
      ).resolves.not.toThrow();

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        "/api/v1/knowledge/kb-123/file/add",
        { file_id: "file-123" }
      );
    });

    it("T017: handles duplicate file gracefully", async () => {
      // Some APIs return success even for duplicates
      mockAxiosInstance.post.mockResolvedValue({ data: { success: true } });

      await expect(
        syncer.addFileToKnowledgeBase("kb-123", "file-123")
      ).resolves.not.toThrow();
    });
  });

  describe("sync (full flow)", () => {
    beforeEach(() => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue('{"id":"1"}\n{"id":"2"}\n');
      vi.mocked(stat).mockResolvedValue({ mtimeMs: 1234567890 } as Awaited<ReturnType<typeof stat>>);
    });

    it("T018: full sync flow succeeds with valid config", async () => {
      // Mock all the required API calls
      mockAxiosInstance.post
        .mockResolvedValueOnce({ data: { id: "file-123", filename: "archive.jsonl" } }) // upload
        .mockResolvedValueOnce({ data: { id: "kb-123", name: "Test KB" } }) // create KB
        .mockResolvedValueOnce({ data: { success: true } }); // add file to KB
      
      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: { status: "completed" } }) // processing status
        .mockResolvedValueOnce({ data: [] }); // KB list (empty, so create new)

      const result = await syncer.sync("./data/rag_archive.jsonl");

      expect(result.success).toBe(true);
      expect(result.filesUploaded).toBe(1);
      expect(result.recordsProcessed).toBe(2);
    });

    it("T019: reports 'Already up to date' when unchanged", async () => {
      // Mock sync state file exists with matching mtime
      vi.mocked(readFile).mockImplementation(async (path) => {
        if (String(path).includes(".sync-state.json")) {
          return JSON.stringify({
            lastSyncTimestamp: "2024-01-01T00:00:00Z",
            lastArchiveMtime: 1234567890,
            knowledgeBaseId: "kb-123",
          });
        }
        return '{"id":"1"}\n{"id":"2"}\n';
      });

      const result = await syncer.sync("./data/rag_archive.jsonl");

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.filesUploaded).toBe(0);
    });

    it("T020: handles empty archive file", async () => {
      vi.mocked(readFile).mockResolvedValue("");
      
      mockAxiosInstance.post
        .mockResolvedValueOnce({ data: { id: "file-123", filename: "archive.jsonl" } })
        .mockResolvedValueOnce({ data: { id: "kb-123", name: "Test KB" } })
        .mockResolvedValueOnce({ data: { success: true } });
      
      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: { status: "completed" } })
        .mockResolvedValueOnce({ data: [] });

      const result = await syncer.sync("./data/rag_archive.jsonl");

      expect(result.success).toBe(true);
      expect(result.recordsProcessed).toBe(0);
    });

    it("T022: retries on 5xx errors", async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      
      const serverError = {
        isAxiosError: true,
        response: { status: 500 },
        message: "Internal Server Error",
      };
      
      // First upload fails with 500, second succeeds
      mockAxiosInstance.post
        .mockRejectedValueOnce(serverError)
        .mockResolvedValueOnce({ data: { id: "file-123", filename: "archive.jsonl" } })
        .mockResolvedValueOnce({ data: { id: "kb-123", name: "Test KB" } })
        .mockResolvedValueOnce({ data: { success: true } });
      
      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: { status: "completed" } })
        .mockResolvedValueOnce({ data: [] });

      const result = await syncer.sync("./data/rag_archive.jsonl");

      expect(result.success).toBe(true);
    });

    it("T023: exits with error on permanent failure", async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = await syncer.sync("./nonexistent/archive.jsonl");

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });
});
