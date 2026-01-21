/**
 * PerplexicaSyncer Unit Tests
 *
 * Tests for the Perplexica RAG sync functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PerplexicaSyncer } from "../perplexica-sync.js";
import type {
  RagDocument,
  PerplexicaSyncState,
} from "../../types/index.js";
import { existsSync, createReadStream } from "node:fs";
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";

// Mock node:fs
vi.mock("node:fs", async () => {
  const actual = await vi.importActual("node:fs");
  return {
    ...actual,
    existsSync: vi.fn(),
    createReadStream: vi.fn(),
  };
});

// Mock node:fs/promises
vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual("node:fs/promises");
  return {
    ...actual,
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
  };
});

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("PerplexicaSyncer", () => {
  const mockDocument: RagDocument = {
    id: "test-123-456",
    chat_id: "https://perplexity.ai/search/test",
    timestamp: "2026-01-15T10:30:00.000Z",
    role: "assistant",
    content: "This is a test response from the AI.",
    metadata: {
      source: "perplexity-mcp-zerver",
      model: "sonar",
      citations: ["https://example.com/1", "https://example.com/2"],
      research_mode: "search",
    },
  };

  const mockUserDocument: RagDocument = {
    id: "test-user-789",
    chat_id: "https://perplexity.ai/search/test",
    timestamp: "2026-01-15T10:29:00.000Z",
    role: "user",
    content: "What is the weather today?",
    metadata: {
      source: "perplexity-mcp-zerver",
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(mkdir).mockResolvedValue(undefined);
    vi.mocked(writeFile).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("constructor", () => {
    it("uses default config when no options provided", () => {
      const syncer = new PerplexicaSyncer();
      // Constructor should not throw
      expect(syncer).toBeInstanceOf(PerplexicaSyncer);
    });

    it("accepts partial config overrides", () => {
      const syncer = new PerplexicaSyncer({
        perplexicaUrl: "http://custom:3000",
        batchSize: 10,
      });
      expect(syncer).toBeInstanceOf(PerplexicaSyncer);
    });
  });

  describe("loadSyncState", () => {
    it("returns default state when file does not exist", async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const syncer = new PerplexicaSyncer();
      const state = await syncer.loadSyncState();

      expect(state).toEqual({
        lastSyncTime: "",
        syncedDocumentIds: [],
        totalSynced: 0,
      });
    });

    it("parses existing state from file", async () => {
      const existingState: PerplexicaSyncState = {
        lastSyncTime: "2026-01-15T10:00:00.000Z",
        syncedDocumentIds: ["doc-1", "doc-2"],
        totalSynced: 2,
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(existingState));

      const syncer = new PerplexicaSyncer();
      const state = await syncer.loadSyncState();

      expect(state).toEqual(existingState);
    });

    it("returns default state on parse error", async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue("invalid json{");

      const syncer = new PerplexicaSyncer();
      const state = await syncer.loadSyncState();

      expect(state).toEqual({
        lastSyncTime: "",
        syncedDocumentIds: [],
        totalSynced: 0,
      });
    });
  });

  describe("saveSyncState", () => {
    it("writes state to file with pretty formatting", async () => {
      const state: PerplexicaSyncState = {
        lastSyncTime: "2026-01-15T12:00:00.000Z",
        syncedDocumentIds: ["doc-1"],
        totalSynced: 1,
      };

      const syncer = new PerplexicaSyncer({
        syncStatePath: "./data/test_sync.json",
      });

      await syncer.saveSyncState(state);

      expect(mkdir).toHaveBeenCalledWith("./data", { recursive: true });
      expect(writeFile).toHaveBeenCalledWith(
        "./data/test_sync.json",
        JSON.stringify(state, null, 2)
      );
    });
  });

  describe("convertToTextFile", () => {
    it("converts assistant document to text format", () => {
      const syncer = new PerplexicaSyncer();
      const result = syncer.convertToTextFile(mockDocument);

      expect(result.filename).toMatch(/^rag_2026-01-15_assistant_test-123\.txt$/);
      expect(result.content).toContain("# Answer");
      expect(result.content).toContain("**Chat ID:** https://perplexity.ai/search/test");
      expect(result.content).toContain("**Role:** assistant");
      expect(result.content).toContain("**Model:** sonar");
      expect(result.content).toContain("**Research Mode:** search");
      expect(result.content).toContain("**Citations:** https://example.com/1, https://example.com/2");
      expect(result.content).toContain("This is a test response from the AI.");
    });

    it("converts user document to text format", () => {
      const syncer = new PerplexicaSyncer();
      const result = syncer.convertToTextFile(mockUserDocument);

      expect(result.filename).toMatch(/^rag_2026-01-15_user_test-use\.txt$/);
      expect(result.content).toContain("# Question");
      expect(result.content).toContain("**Role:** user");
      expect(result.content).not.toContain("**Model:**");
      expect(result.content).toContain("What is the weather today?");
    });
  });

  describe("isAlreadySynced", () => {
    it("returns true for synced document ID", () => {
      const syncer = new PerplexicaSyncer();
      const state: PerplexicaSyncState = {
        lastSyncTime: "",
        syncedDocumentIds: ["doc-1", "doc-2", "doc-3"],
        totalSynced: 3,
      };

      expect(syncer.isAlreadySynced("doc-2", state)).toBe(true);
    });

    it("returns false for new document ID", () => {
      const syncer = new PerplexicaSyncer();
      const state: PerplexicaSyncState = {
        lastSyncTime: "",
        syncedDocumentIds: ["doc-1", "doc-2"],
        totalSynced: 2,
      };

      expect(syncer.isAlreadySynced("doc-new", state)).toBe(false);
    });
  });

  describe("checkConnection", () => {
    it("returns true when Perplexica is available", async () => {
      mockFetch.mockResolvedValue({ ok: true });

      const syncer = new PerplexicaSyncer({
        perplexicaUrl: "http://localhost:3001",
      });

      const result = await syncer.checkConnection();
      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith("http://localhost:3001", expect.objectContaining({
        method: "HEAD",
      }));
    });

    it("returns false when Perplexica is not available", async () => {
      mockFetch.mockRejectedValue(new Error("Connection refused"));

      const syncer = new PerplexicaSyncer();
      const result = await syncer.checkConnection();

      expect(result).toBe(false);
    });

    it("returns false on non-OK response", async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 503 });

      const syncer = new PerplexicaSyncer();
      const result = await syncer.checkConnection();

      expect(result).toBe(false);
    });
  });

  describe("uploadDocuments", () => {
    it("uploads documents via POST /api/uploads", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          files: [{ id: "file-1", name: "test.txt", status: "success" }],
        }),
      });

      const syncer = new PerplexicaSyncer({
        perplexicaUrl: "http://localhost:3001",
        embeddingModel: "nomic-embed-text",
        embeddingProvider: "ollama",
      });

      const result = await syncer.uploadDocuments([mockDocument]);

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/uploads",
        expect.objectContaining({
          method: "POST",
          body: expect.any(FormData),
        })
      );
      expect(result.files).toHaveLength(1);
    });

    it("throws on upload failure", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => "Missing embedding model",
      });

      const syncer = new PerplexicaSyncer();

      await expect(syncer.uploadDocuments([mockDocument])).rejects.toThrow(
        "Perplexica upload failed (400): Missing embedding model"
      );
    });
  });

  describe("sync", () => {
    it("returns success when no documents in archive", async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      mockFetch.mockResolvedValue({ ok: true });

      const syncer = new PerplexicaSyncer();
      const result = await syncer.sync();

      expect(result.success).toBe(true);
      expect(result.newDocumentsSynced).toBe(0);
      expect(result.skippedDocuments).toBe(0);
    });

    it("returns error when Perplexica is not available", async () => {
      mockFetch.mockRejectedValue(new Error("Connection refused"));

      const syncer = new PerplexicaSyncer();
      const result = await syncer.sync();

      expect(result.success).toBe(false);
      expect(result.errors).toContain("Perplexica not available at http://localhost:3001");
    });

    it("skips connection check in dry-run mode", async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const syncer = new PerplexicaSyncer();
      const result = await syncer.sync({ dryRun: true });

      expect(result.success).toBe(true);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("skips already-synced documents", async () => {
      const existingState: PerplexicaSyncState = {
        lastSyncTime: "2026-01-15T10:00:00.000Z",
        syncedDocumentIds: [mockDocument.id],
        totalSynced: 1,
      };

      vi.mocked(existsSync).mockImplementation((path) => {
        if (String(path).includes("sync.json")) return true;
        return false;
      });

      vi.mocked(readFile).mockResolvedValue(JSON.stringify(existingState));

      mockFetch.mockResolvedValue({ ok: true });

      const syncer = new PerplexicaSyncer();

      // Spy on readArchive to return mock documents
      vi.spyOn(syncer, "readArchive").mockResolvedValue([mockDocument]);

      const result = await syncer.sync({ dryRun: true });

      expect(result.skippedDocuments).toBe(1);
      expect(result.newDocumentsSynced).toBe(0);
    });

    it("uploads new documents that are not yet synced", async () => {
      const existingState: PerplexicaSyncState = {
        lastSyncTime: "2026-01-15T10:00:00.000Z",
        syncedDocumentIds: [],
        totalSynced: 0,
      };

      vi.mocked(existsSync).mockImplementation((path) => {
        if (String(path).includes("sync.json")) return true;
        return false;
      });

      vi.mocked(readFile).mockResolvedValue(JSON.stringify(existingState));

      mockFetch
        .mockResolvedValueOnce({ ok: true }) // checkConnection
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            files: [{ id: "file-1", name: "test.txt", status: "success" }],
          }),
        }); // upload

      const syncer = new PerplexicaSyncer();

      // Spy on readArchive to return mock documents
      vi.spyOn(syncer, "readArchive").mockResolvedValue([mockDocument]);

      const result = await syncer.sync({ verbose: false });

      expect(result.newDocumentsSynced).toBe(1);
      expect(result.skippedDocuments).toBe(0);
      expect(result.success).toBe(true);
    });
  });
});
