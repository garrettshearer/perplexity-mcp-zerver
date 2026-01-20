import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock the dependencies before importing BrowserManager
vi.mock("../../utils/logging.js", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
}));

vi.mock("../../utils/puppeteer.js", () => ({
  initializeBrowser: vi.fn(),
  navigateToPerplexity: vi.fn(),
  waitForSearchInput: vi.fn(),
  checkForCaptcha: vi.fn(),
  recoveryProcedure: vi.fn(),
  resetIdleTimeout: vi.fn(),
}));

describe("BrowserManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Promise-Based Initialization Lock", () => {
    it("should prevent concurrent initialization calls from starting multiple browsers", async () => {
      const { BrowserManager } = await import("../../server/modules/BrowserManager.js");
      const { initializeBrowser } = await import("../../utils/puppeteer.js");

      const manager = new BrowserManager();
      let initCallCount = 0;
      let resolveInit: (() => void) | undefined;

      // Create a promise that we control to simulate slow initialization
      const initPromise = new Promise<void>((resolve) => {
        resolveInit = resolve;
      });

      // Mock initializeBrowser to track calls and use our controlled promise
      vi.mocked(initializeBrowser).mockImplementation(async () => {
        initCallCount++;
        await initPromise;
      });

      // Call initialize() twice simultaneously
      const firstCall = manager.initialize();
      const secondCall = manager.initialize();

      // Both should wait for the same initialization
      // Let the initialization complete
      if (resolveInit) resolveInit();

      await Promise.all([firstCall, secondCall]);

      // initializeBrowser should only be called ONCE despite two initialize() calls
      expect(initCallCount).toBe(1);
    });

    it("should release lock after initialization failure, allowing retry", async () => {
      const { BrowserManager } = await import("../../server/modules/BrowserManager.js");
      const { initializeBrowser } = await import("../../utils/puppeteer.js");

      const manager = new BrowserManager();
      let callCount = 0;

      // First call fails
      vi.mocked(initializeBrowser).mockImplementationOnce(async () => {
        callCount++;
        throw new Error("Initialization failed");
      });

      // Second call succeeds
      vi.mocked(initializeBrowser).mockImplementationOnce(async () => {
        callCount++;
      });

      // First initialization should fail
      await expect(manager.initialize()).rejects.toThrow("Initialization failed");

      // Second initialization should be allowed (lock released)
      await manager.initialize();

      // Both calls should have been made
      expect(callCount).toBe(2);
    });

    it("should return initPromise and setInitPromise from getPuppeteerContext", async () => {
      const { BrowserManager } = await import("../../server/modules/BrowserManager.js");

      const manager = new BrowserManager();
      const ctx = manager.getPuppeteerContext();

      // Should have initPromise property (initially null)
      expect(ctx).toHaveProperty("initPromise");
      expect(ctx.initPromise).toBeNull();

      // Should have setInitPromise method
      expect(ctx).toHaveProperty("setInitPromise");
      expect(typeof ctx.setInitPromise).toBe("function");

      // Test setInitPromise works
      const testPromise = Promise.resolve();
      ctx.setInitPromise(testPromise);
      
      // Note: getPuppeteerContext returns a snapshot, need to get fresh context
      const updatedCtx = manager.getPuppeteerContext();
      expect(updatedCtx.initPromise).toBe(testPromise);
    });
  });
});
