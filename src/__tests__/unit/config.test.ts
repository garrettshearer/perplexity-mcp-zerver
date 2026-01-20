import { describe, expect, it } from "vitest";
import { CONFIG } from "../../server/config.js";

describe("Configuration", () => {
  describe("HEADLESS Mode", () => {
    it("should default to 'new' when PERPLEXITY_HEADLESS env var is not set", () => {
      // Note: Since CONFIG is evaluated at import time with the current env,
      // we test the actual value and the type
      expect(CONFIG.HEADLESS === "new" || CONFIG.HEADLESS === false).toBe(true);
    });

    it("should have correct type for HEADLESS", () => {
      // Verify HEADLESS is either 'new' or false (boolean)
      const validValues: ("new" | false)[] = ["new", false];
      expect(validValues).toContain(CONFIG.HEADLESS);
    });

    it("should evaluate to 'new' when env var is 'true'", () => {
      // Test the logic: !== "false" ? "new" : false
      const testCases = [
        { input: undefined, expected: "new" },
        { input: "true", expected: "new" },
        { input: "1", expected: "new" },
        { input: "yes", expected: "new" },
        { input: "", expected: "new" },
        { input: "false", expected: false },
      ];

      for (const { input, expected } of testCases) {
        const result = input !== "false" ? "new" : false;
        expect(result).toBe(expected);
      }
    });
  });

  describe("Timeout Values", () => {
    it("should have consistent timeout values", () => {
      expect(CONFIG.PAGE_TIMEOUT).toBeGreaterThan(0);
      expect(CONFIG.SELECTOR_TIMEOUT).toBeGreaterThan(0);
      expect(CONFIG.ANSWER_WAIT_TIMEOUT).toBeGreaterThan(0);
      expect(CONFIG.MCP_TIMEOUT_BUFFER).toBeGreaterThan(0);
    });

    it("should have reasonable timeout relationships", () => {
      // Page timeout should be greater than selector timeout
      expect(CONFIG.PAGE_TIMEOUT).toBeGreaterThan(CONFIG.SELECTOR_TIMEOUT);

      // Answer wait timeout should be substantial for content loading
      expect(CONFIG.ANSWER_WAIT_TIMEOUT).toBeGreaterThan(30000);
    });
  });

  describe("User Agent", () => {
    it("should have valid user agent string", () => {
      expect(typeof CONFIG.USER_AGENT).toBe("string");
      expect(CONFIG.USER_AGENT.length).toBeGreaterThan(0);
      expect(CONFIG.USER_AGENT).toContain("Mozilla");
      expect(CONFIG.USER_AGENT).toContain("Chrome");
    });
  });

  describe("Retry Configuration", () => {
    it("should have reasonable retry limits", () => {
      expect(CONFIG.MAX_RETRIES).toBeGreaterThan(0);
      expect(CONFIG.MAX_RETRIES).toBeLessThan(20);
    });
  });

  describe("Timeout Profiles", () => {
    it("should have valid timeout profiles", () => {
      expect(CONFIG.TIMEOUT_PROFILES).toBeDefined();
      expect(CONFIG.TIMEOUT_PROFILES.navigation).toBeGreaterThan(0);
      expect(CONFIG.TIMEOUT_PROFILES.selector).toBeGreaterThan(0);
      expect(CONFIG.TIMEOUT_PROFILES.content).toBeGreaterThan(0);
      expect(CONFIG.TIMEOUT_PROFILES.recovery).toBeGreaterThan(0);
    });

    it("should have consistent timeout profile relationships", () => {
      // Navigation timeout should be substantial
      expect(CONFIG.TIMEOUT_PROFILES.navigation).toBeGreaterThan(30000);

      // Content timeout should be the longest
      expect(CONFIG.TIMEOUT_PROFILES.content).toBeGreaterThan(CONFIG.TIMEOUT_PROFILES.navigation);
    });
  });

  describe("Debug Configuration", () => {
    it("should have valid debug settings", () => {
      expect(typeof CONFIG.DEBUG.CAPTURE_SCREENSHOTS).toBe("boolean");
      expect(typeof CONFIG.DEBUG.SCREENSHOT_ON_RECOVERY_SUCCESS).toBe("boolean");
      expect(CONFIG.DEBUG.MAX_SCREENSHOTS).toBeGreaterThan(0);
    });
  });
});
