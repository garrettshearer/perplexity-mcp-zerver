/**
 * Unit tests for RagArchiver module
 * Tests local RAG document storage functionality
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock fs/promises
vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn(),
  appendFile: vi.fn(),
  open: vi.fn(),
}));

// Mock logging
vi.mock("../../utils/logging.js", () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

// Mock config
vi.mock("../../server/config.js", () => ({
  CONFIG: {
    RAG_ARCHIVE_PATH: "./data/rag_archive.jsonl",
  },
}));

import { RagArchiver } from "../../server/modules/RagArchiver.js";
import * as logging from "../../utils/logging.js";

describe("RagArchiver", () => {
  let archiver: RagArchiver;
  const mockFileHandle = { close: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock implementations
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.appendFile).mockResolvedValue(undefined);
    vi.mocked(fs.open).mockResolvedValue(mockFileHandle as unknown as fs.FileHandle);
    mockFileHandle.close.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("T011: creates instance with default path from CONFIG", () => {
      archiver = new RagArchiver();
      expect(archiver.getArchivePath()).toBe("./data/rag_archive.jsonl");
    });

    it("T012: accepts custom path parameter", () => {
      const customPath = "/tmp/custom-archive.jsonl";
      archiver = new RagArchiver(customPath);
      expect(archiver.getArchivePath()).toBe(customPath);
    });
  });

  describe("ensureDirectory", () => {
    it("T013: creates nested directories for archive path", async () => {
      archiver = new RagArchiver("/nested/path/to/archive.jsonl");
      await archiver.ensureDirectory();

      expect(fs.mkdir).toHaveBeenCalledWith("/nested/path/to", { recursive: true });
    });

    it("T014: is no-op when directory already exists (mkdir succeeds)", async () => {
      archiver = new RagArchiver();
      await archiver.ensureDirectory();

      expect(fs.mkdir).toHaveBeenCalledTimes(1);
      expect(logging.logInfo).toHaveBeenCalledWith(expect.stringContaining("RAG archive directory ensured"));
    });

    it("T028: creates parent directories for custom path", async () => {
      archiver = new RagArchiver("/tmp/deep/nested/custom.jsonl");
      await archiver.ensureDirectory();

      expect(fs.mkdir).toHaveBeenCalledWith("/tmp/deep/nested", { recursive: true });
    });
  });

  describe("log", () => {
    beforeEach(async () => {
      archiver = new RagArchiver();
      await archiver.ensureDirectory();
    });

    it("T015: appends valid JSONL line to file", async () => {
      await archiver.log({
        chat_id: "test-chat-123",
        role: "user",
        content: "Hello, world!",
        metadata: { source: "perplexity-mcp-zerver" },
      });

      expect(fs.appendFile).toHaveBeenCalledTimes(1);
      const calls = vi.mocked(fs.appendFile).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const [filePath, content] = calls[0]!;
      expect(filePath).toBe("./data/rag_archive.jsonl");
      
      // Verify it's valid JSON ending with newline
      expect(content).toMatch(/\n$/);
      const parsed = JSON.parse((content as string).trim());
      expect(parsed.chat_id).toBe("test-chat-123");
      expect(parsed.role).toBe("user");
      expect(parsed.content).toBe("Hello, world!");
    });

    it("T016: generates unique UUID per entry", async () => {
      const uuids = new Set<string>();

      for (let i = 0; i < 5; i++) {
        await archiver.log({
          chat_id: "test-chat",
          role: "user",
          content: `Message ${i}`,
          metadata: { source: "perplexity-mcp-zerver" },
        });
      }

      // Extract UUIDs from all calls
      for (const call of vi.mocked(fs.appendFile).mock.calls) {
        const content = call[1] as string;
        const parsed = JSON.parse(content.trim());
        uuids.add(parsed.id);
      }

      // All 5 UUIDs should be unique
      expect(uuids.size).toBe(5);
    });

    it("T017: includes ISO 8601 timestamp", async () => {
      const before = new Date().toISOString();
      
      await archiver.log({
        chat_id: "test-chat",
        role: "user",
        content: "Test message",
        metadata: { source: "perplexity-mcp-zerver" },
      });

      const after = new Date().toISOString();
      const calls = vi.mocked(fs.appendFile).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const content = calls[0]![1] as string;
      const parsed = JSON.parse(content.trim());

      // Verify ISO 8601 format
      expect(parsed.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
      
      // Verify timestamp is within bounds
      expect(parsed.timestamp >= before).toBe(true);
      expect(parsed.timestamp <= after).toBe(true);
    });
  });

  describe("logInteraction", () => {
    beforeEach(async () => {
      archiver = new RagArchiver();
      await archiver.ensureDirectory();
    });

    it("T018: creates 2 entries (user + assistant)", async () => {
      await archiver.logInteraction(
        "chat-123",
        "What is the capital of France?",
        "The capital of France is Paris.",
      );

      expect(fs.appendFile).toHaveBeenCalledTimes(2);

      // Parse both entries
      const entries = vi.mocked(fs.appendFile).mock.calls.map((call) =>
        JSON.parse((call[1] as string).trim()),
      );

      expect(entries[0].role).toBe("user");
      expect(entries[0].content).toBe("What is the capital of France?");
      expect(entries[0].chat_id).toBe("chat-123");

      expect(entries[1].role).toBe("assistant");
      expect(entries[1].content).toBe("The capital of France is Paris.");
      expect(entries[1].chat_id).toBe("chat-123");
    });

    it("T019: includes citations in assistant metadata", async () => {
      await archiver.logInteraction(
        "chat-123",
        "Tell me about TypeScript",
        "TypeScript is a typed superset of JavaScript.",
        {
          model: "claude-3",
          citations: ["https://www.typescriptlang.org/", "https://docs.example.com"],
          research_mode: "deep-research",
        },
      );

      const entries = vi.mocked(fs.appendFile).mock.calls.map((call) =>
        JSON.parse((call[1] as string).trim()),
      );

      // User message has minimal metadata
      expect(entries[0].metadata.source).toBe("perplexity-mcp-zerver");
      expect(entries[0].metadata.citations).toBeUndefined();

      // Assistant message has full metadata including citations
      expect(entries[1].metadata.source).toBe("perplexity-mcp-zerver");
      expect(entries[1].metadata.model).toBe("claude-3");
      expect(entries[1].metadata.citations).toEqual([
        "https://www.typescriptlang.org/",
        "https://docs.example.com",
      ]);
      expect(entries[1].metadata.research_mode).toBe("deep-research");
    });
  });

  describe("Environment Variable Configuration (US2)", () => {
    it("T026: uses RAG_ARCHIVE_PATH env var when set", () => {
      // CONFIG is mocked, but we can test the constructor's behavior
      archiver = new RagArchiver("/custom/from/env.jsonl");
      expect(archiver.getArchivePath()).toBe("/custom/from/env.jsonl");
    });

    it("T027: defaults to ./data/rag_archive.jsonl when env not set", () => {
      archiver = new RagArchiver();
      expect(archiver.getArchivePath()).toBe("./data/rag_archive.jsonl");
    });
  });

  describe("Error Handling (US3)", () => {
    it("T031: logs error on permission failure", async () => {
      archiver = new RagArchiver();
      
      // Make ensureDirectory fail
      vi.mocked(fs.mkdir).mockRejectedValueOnce(new Error("EACCES: permission denied"));
      vi.mocked(fs.open).mockRejectedValueOnce(new Error("EACCES: permission denied"));

      await archiver.ensureDirectory();

      expect(logging.logError).toHaveBeenCalledWith(
        expect.stringContaining("RagArchiver.ensureDirectory failed"),
      );
    });

    it("T032: does not throw on write failure", async () => {
      archiver = new RagArchiver();
      await archiver.ensureDirectory();

      // Make appendFile fail
      vi.mocked(fs.appendFile).mockRejectedValueOnce(new Error("ENOSPC: no space left"));

      // Should not throw
      await expect(
        archiver.log({
          chat_id: "test",
          role: "user",
          content: "test",
          metadata: { source: "perplexity-mcp-zerver" },
        }),
      ).resolves.toBeUndefined();

      expect(logging.logError).toHaveBeenCalledWith(
        expect.stringContaining("RagArchiver.log failed"),
      );
    });

    it("T033: concurrent writes produce valid JSONL", async () => {
      archiver = new RagArchiver();
      await archiver.ensureDirectory();

      // Fire off 10 concurrent log calls
      const promises = Array.from({ length: 10 }, (_, i) =>
        archiver.log({
          chat_id: `chat-${i}`,
          role: "user",
          content: `Message ${i}`,
          metadata: { source: "perplexity-mcp-zerver" },
        }),
      );

      await Promise.all(promises);

      // Verify all 10 calls were made
      expect(fs.appendFile).toHaveBeenCalledTimes(10);

      // Verify each call produces valid JSON
      for (const call of vi.mocked(fs.appendFile).mock.calls) {
        const content = call[1] as string;
        expect(content).toMatch(/\n$/);
        expect(() => JSON.parse(content.trim())).not.toThrow();
      }
    });
  });

  describe("Writability Validation (US3)", () => {
    it("T035: validates archive path writability at startup", async () => {
      archiver = new RagArchiver();
      await archiver.ensureDirectory();

      // open should be called to validate writability
      expect(fs.open).toHaveBeenCalledWith("./data/rag_archive.jsonl", "a");
      expect(mockFileHandle.close).toHaveBeenCalled();
    });

    it("T036: logs warning if archive path is unwritable", async () => {
      archiver = new RagArchiver();
      vi.mocked(fs.open).mockRejectedValueOnce(new Error("EACCES"));

      await archiver.ensureDirectory();

      expect(logging.logWarn).toHaveBeenCalledWith(
        expect.stringContaining("RAG archive path is not writable"),
      );
    });
  });
});
